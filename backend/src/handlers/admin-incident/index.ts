import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';
import { ddb, MAIN_TABLE } from '../../shared/db/client';
import { extractTenantId, extractUserId } from '../../shared/auth/extract-tenant';
import { respond } from '../../shared/errors/handler-wrapper';
import { HttpError } from '../../shared/errors/http-error';
import {
  createIncidentSchema,
  updateIncidentSchema,
  addIncidentUpdateSchema,
} from '../../shared/validation/schemas';
import type { Incident, IncidentUpdate, Org } from '../../shared/types';

const sns = new SNSClient({});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const pathParams = event.pathParameters ?? {};
  const incidentId = pathParams['incidentId'];
  const isUpdatePath = event.rawPath.endsWith('/updates');

  try {
    if (method === 'GET' && !incidentId) return await listIncidents(event);
    if (method === 'POST' && !incidentId) return await createIncident(event);
    if (method === 'GET' && incidentId) return await getIncident(event, incidentId);
    if (method === 'PUT' && incidentId && !isUpdatePath) return await updateIncident(event, incidentId);
    if (method === 'DELETE' && incidentId) return await deleteIncident(event, incidentId);
    if (method === 'POST' && incidentId && isUpdatePath) return await addUpdate(event, incidentId);
    return respond(404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError) return respond(err.statusCode, { error: err.message });
    console.error(err);
    return respond(500, { error: 'Internal server error' });
  }
};

async function listIncidents(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);
  const statusFilter = event.queryStringParameters?.['status'];

  const result = await ddb.send(
    new QueryCommand({
      TableName: MAIN_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `ORG#${tenantId}`, ':prefix': 'INCIDENT#' },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );

  let incidents = (result.Items ?? []) as Incident[];
  if (statusFilter === 'open') {
    incidents = incidents.filter((i) => i.status !== 'resolved');
  }

  return respond(200, { incidents });
}

async function createIncident(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);
  const userId = extractUserId(event);

  const body = createIncidentSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!body.success) throw new HttpError(400, body.error.errors[0].message);

  const incidentId = uuidv4();
  const updateId = uuidv4();
  const now = new Date().toISOString();
  const { title, status, impact, monitorId, message } = body.data;

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: MAIN_TABLE,
            Item: {
              PK: `ORG#${tenantId}`,
              SK: `INCIDENT#${incidentId}`,
              incidentId,
              tenantId,
              title,
              status,
              impact,
              ...(monitorId && { monitorId }),
              createdAt: now,
              updatedAt: now,
            },
          },
        },
        {
          Put: {
            TableName: MAIN_TABLE,
            Item: {
              PK: `INCIDENT#${incidentId}`,
              SK: `UPDATE#${now}#${updateId}`,
              updateId,
              incidentId,
              tenantId,
              message,
              status,
              createdAt: now,
              createdBy: userId,
            },
          },
        },
      ],
    }),
  );

  await publishIncidentNotification(tenantId, title, status, message);

  const incident = await getIncidentItem(tenantId, incidentId);
  return respond(201, { incident });
}

async function getIncident(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  incidentId: string,
) {
  const tenantId = extractTenantId(event);
  const incident = await getIncidentItem(tenantId, incidentId);

  const updatesResult = await ddb.send(
    new QueryCommand({
      TableName: MAIN_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `INCIDENT#${incidentId}`,
        ':prefix': 'UPDATE#',
      },
      ScanIndexForward: false,
    }),
  );

  return respond(200, { incident, updates: updatesResult.Items ?? [] });
}

async function updateIncident(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  incidentId: string,
) {
  const tenantId = extractTenantId(event);
  const userId = extractUserId(event);

  await getIncidentItem(tenantId, incidentId); // ownership check

  const body = updateIncidentSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!body.success) throw new HttpError(400, body.error.errors[0].message);

  const now = new Date().toISOString();
  const updateId = uuidv4();
  const updates: string[] = ['updatedAt = :now'];
  const values: Record<string, unknown> = { ':now': now };

  if (body.data.title) { updates.push('title = :title'); values[':title'] = body.data.title; }
  if (body.data.status) { updates.push('#status = :status'); values[':status'] = body.data.status; }
  if (body.data.impact) { updates.push('impact = :impact'); values[':impact'] = body.data.impact; }
  if (body.data.status === 'resolved') {
    updates.push('resolvedAt = :resolved');
    values[':resolved'] = now;
  }

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: MAIN_TABLE,
            Key: { PK: `ORG#${tenantId}`, SK: `INCIDENT#${incidentId}` },
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeNames: body.data.status ? { '#status': 'status' } : undefined,
            ExpressionAttributeValues: values,
            ConditionExpression: 'attribute_exists(PK)',
          },
        },
        {
          Put: {
            TableName: MAIN_TABLE,
            Item: {
              PK: `INCIDENT#${incidentId}`,
              SK: `UPDATE#${now}#${updateId}`,
              updateId,
              incidentId,
              tenantId,
              message: body.data.message,
              status: body.data.status,
              createdAt: now,
              createdBy: userId,
            },
          },
        },
      ],
    }),
  );

  if (body.data.status) {
    await publishIncidentNotification(tenantId, body.data.title ?? '', body.data.status, body.data.message);
  }

  const updated = await getIncidentItem(tenantId, incidentId);
  return respond(200, { incident: updated });
}

async function deleteIncident(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  incidentId: string,
) {
  const tenantId = extractTenantId(event);
  await getIncidentItem(tenantId, incidentId); // ownership check

  await ddb.send(
    new DeleteCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: `INCIDENT#${incidentId}` },
    }),
  );

  return respond(204, null);
}

async function addUpdate(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  incidentId: string,
) {
  const tenantId = extractTenantId(event);
  const userId = extractUserId(event);
  await getIncidentItem(tenantId, incidentId);

  const body = addIncidentUpdateSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!body.success) throw new HttpError(400, body.error.errors[0].message);

  const now = new Date().toISOString();
  const updateId = uuidv4();

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: MAIN_TABLE,
            Item: {
              PK: `INCIDENT#${incidentId}`,
              SK: `UPDATE#${now}#${updateId}`,
              updateId,
              incidentId,
              tenantId,
              message: body.data.message,
              status: body.data.status,
              createdAt: now,
              createdBy: userId,
            },
          },
        },
        {
          Update: {
            TableName: MAIN_TABLE,
            Key: { PK: `ORG#${tenantId}`, SK: `INCIDENT#${incidentId}` },
            UpdateExpression: 'SET updatedAt = :now, #status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':now': now, ':status': body.data.status },
          },
        },
      ],
    }),
  );

  return respond(201, { updateId, incidentId });
}

async function getIncidentItem(tenantId: string, incidentId: string): Promise<Incident> {
  const result = await ddb.send(
    new GetCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: `INCIDENT#${incidentId}` },
    }),
  );
  if (!result.Item) throw new HttpError(404, 'Incident not found');
  const incident = result.Item as Incident & { tenantId: string };
  if (incident.tenantId !== tenantId) throw new HttpError(403, 'Forbidden');
  return incident;
}

async function publishIncidentNotification(
  tenantId: string,
  title: string,
  status: string,
  message: string,
) {
  try {
    const orgResult = await ddb.send(
      new GetCommand({ TableName: MAIN_TABLE, Key: { PK: `ORG#${tenantId}`, SK: 'METADATA' } }),
    );
    const org = orgResult.Item as Org | undefined;
    if (!org?.snsTopicArn) return;

    await sns.send(
      new PublishCommand({
        TopicArn: org.snsTopicArn,
        Subject: `[Status Page] Incident: ${title} — ${status}`,
        Message: `Incident Update\n\nTitle: ${title}\nStatus: ${status}\n\n${message}`,
      }),
    );
  } catch (err) {
    console.error('Failed to publish SNS notification:', err);
    // Non-fatal — don't fail the API call
  }
}
