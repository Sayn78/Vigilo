import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, CreateTopicCommand, SubscribeCommand, UnsubscribeCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';
import { ddb, MAIN_TABLE } from '../../shared/db/client';
import { extractTenantId, extractUserId, extractUserEmail } from '../../shared/auth/extract-tenant';
import { respond } from '../../shared/errors/handler-wrapper';
import { HttpError } from '../../shared/errors/http-error';
import { createOrgSchema, updateOrgSchema } from '../../shared/validation/schemas';
import type { Org } from '../../shared/types';

const sns = new SNSClient({});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  try {
    if (method === 'POST' && path === '/admin/org') return await createOrg(event);
    if (method === 'GET' && path === '/admin/org') return await getOrg(event);
    if (method === 'PUT' && path === '/admin/org') return await updateOrg(event);
    if (method === 'DELETE' && path === '/admin/org') return await deleteOrg(event);
    return respond(404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError) return respond(err.statusCode, { error: err.message });
    console.error(err);
    return respond(500, { error: 'Internal server error' });
  }
};

async function createOrg(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);
  const userId = extractUserId(event);
  const ownerEmail = extractUserEmail(event);

  const body = createOrgSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!body.success) throw new HttpError(400, body.error.errors[0].message);

  const { name, slug, notifyEmail } = body.data;
  const now = new Date().toISOString();

  // Check slug uniqueness and create org atomically
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            // Org record
            Put: {
              TableName: MAIN_TABLE,
              Item: {
                PK: `ORG#${tenantId}`,
                SK: 'METADATA',
                tenantId,
                slug,
                name,
                ownerEmail,
                notifyEmail,
                snsTopicArn: '', // filled below
                createdAt: now,
                updatedAt: now,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            // Slug uniqueness lock
            Put: {
              TableName: MAIN_TABLE,
              Item: {
                PK: `SLUG#${slug}`,
                SK: 'METADATA',
                slug,
                tenantId,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e?.name === 'TransactionCanceledException') {
      throw new HttpError(409, 'Organization already exists or slug is already taken');
    }
    throw err;
  }

  // Create per-tenant SNS topic and subscribe notifyEmail
  const topicResult = await sns.send(
    new CreateTopicCommand({ Name: `status-page-${tenantId.replace(/-/g, '')}` }),
  );
  const snsTopicArn = topicResult.TopicArn!;

  await sns.send(
    new SubscribeCommand({
      TopicArn: snsTopicArn,
      Protocol: 'email',
      Endpoint: notifyEmail,
    }),
  );

  // Update org with SNS topic ARN
  await ddb.send(
    new UpdateCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: 'METADATA' },
      UpdateExpression: 'SET snsTopicArn = :arn',
      ExpressionAttributeValues: { ':arn': snsTopicArn },
    }),
  );

  const org = await getOrgItem(tenantId);
  return respond(201, { org: sanitizeOrg(org) });
}

async function getOrg(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);
  const org = await getOrgItem(tenantId);

  let snsSubscriptionConfirmed = false;

  if (org.snsConfirmedAt) {
    // Already confirmed — use cached value, no SNS call needed
    snsSubscriptionConfirmed = true;
  } else if (org.snsTopicArn) {
    // Check live subscription status from SNS
    const subsResult = await sns.send(
      new ListSubscriptionsByTopicCommand({ TopicArn: org.snsTopicArn }),
    );
    const sub = subsResult.Subscriptions?.find(
      (s) => s.Endpoint === org.notifyEmail && s.Protocol === 'email',
    );
    if (sub?.SubscriptionArn && sub.SubscriptionArn !== 'PendingConfirmation' && sub.SubscriptionArn !== 'deleted') {
      snsSubscriptionConfirmed = true;
      // Cache confirmation in DynamoDB to avoid future SNS calls
      await ddb.send(
        new UpdateCommand({
          TableName: MAIN_TABLE,
          Key: { PK: `ORG#${tenantId}`, SK: 'METADATA' },
          UpdateExpression: 'SET snsConfirmedAt = :now',
          ExpressionAttributeValues: { ':now': new Date().toISOString() },
        }),
      );
    }
  }

  return respond(200, { org: { ...sanitizeOrg(org), snsSubscriptionConfirmed } });
}

async function updateOrg(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);

  const body = updateOrgSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!body.success) throw new HttpError(400, body.error.errors[0].message);

  const updates: string[] = [];
  const values: Record<string, unknown> = {};

  if (body.data.name) {
    updates.push('name = :name');
    values[':name'] = body.data.name;
  }
  if (body.data.notifyEmail) {
    updates.push('notifyEmail = :email');
    values[':email'] = body.data.notifyEmail;
  }
  updates.push('updatedAt = :now');
  values[':now'] = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: 'METADATA' },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(PK)',
    }),
  );

  const org = await getOrgItem(tenantId);
  return respond(200, { org: sanitizeOrg(org) });
}

async function deleteOrg(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);

  // Soft delete: mark as deleted
  await ddb.send(
    new UpdateCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: 'METADATA' },
      UpdateExpression: 'SET deletedAt = :now',
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
      ConditionExpression: 'attribute_exists(PK)',
    }),
  );

  return respond(204, null);
}

async function getOrgItem(tenantId: string): Promise<Org> {
  const result = await ddb.send(
    new GetCommand({ TableName: MAIN_TABLE, Key: { PK: `ORG#${tenantId}`, SK: 'METADATA' } }),
  );
  if (!result.Item) throw new HttpError(404, 'Organization not found');
  return result.Item as Org;
}

function sanitizeOrg(org: Org) {
  // Never expose snsTopicArn to the client
  const { snsTopicArn, ...safe } = org;
  return safe;
}
