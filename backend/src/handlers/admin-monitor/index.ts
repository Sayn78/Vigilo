import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ddb, MAIN_TABLE, CHECKS_TABLE } from '../../shared/db/client';
import { extractTenantId } from '../../shared/auth/extract-tenant';
import { respond } from '../../shared/errors/handler-wrapper';
import { HttpError } from '../../shared/errors/http-error';
import { createMonitorSchema, updateMonitorSchema } from '../../shared/validation/schemas';
import type { Monitor } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const pathParams = event.pathParameters ?? {};
  const monitorId = pathParams['monitorId'];

  try {
    if (method === 'GET' && !monitorId) return await listMonitors(event);
    if (method === 'POST' && !monitorId) return await createMonitor(event);
    if (method === 'GET' && monitorId && !event.rawPath.endsWith('/checks') && !event.rawPath.endsWith('/uptime'))
      return await getMonitor(event, monitorId);
    if (method === 'GET' && monitorId && event.rawPath.endsWith('/checks'))
      return await getMonitorChecks(event, monitorId);
    if (method === 'GET' && monitorId && event.rawPath.endsWith('/uptime'))
      return await getMonitorUptime(event, monitorId);
    if (method === 'PUT' && monitorId) return await updateMonitor(event, monitorId);
    if (method === 'DELETE' && monitorId) return await deleteMonitor(event, monitorId);
    return respond(404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError) return respond(err.statusCode, { error: err.message });
    console.error(err);
    return respond(500, { error: 'Internal server error' });
  }
};

async function listMonitors(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);

  const result = await ddb.send(
    new QueryCommand({
      TableName: MAIN_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${tenantId}`,
        ':prefix': 'MONITOR#',
      },
    }),
  );

  const monitors = (result.Items ?? []) as Monitor[];
  return respond(200, { monitors: monitors.map(sanitizeMonitor) });
}

async function createMonitor(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const tenantId = extractTenantId(event);

  const body = createMonitorSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!body.success) throw new HttpError(400, body.error.errors[0].message);

  const monitorId = uuidv4();
  const now = new Date().toISOString();
  const { name, url, method: httpMethod, expectedStatus, timeoutMs } = body.data;

  const monitor: Monitor = {
    monitorId,
    tenantId,
    name,
    url,
    method: httpMethod,
    expectedStatus,
    timeoutMs,
    currentStatus: 'unknown',
    lastCheckedAt: null,
    createdAt: now,
    enabled: 'true',
    entityType: 'MONITOR',
  };

  await ddb.send(
    new PutCommand({
      TableName: MAIN_TABLE,
      Item: {
        PK: `ORG#${tenantId}`,
        SK: `MONITOR#${monitorId}`,
        ...monitor,
      },
    }),
  );

  return respond(201, { monitor: sanitizeMonitor(monitor) });
}

async function getMonitor(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  monitorId: string,
) {
  const tenantId = extractTenantId(event);
  const monitor = await getMonitorItem(tenantId, monitorId);
  assertOwnership(monitor.tenantId, tenantId);
  return respond(200, { monitor: sanitizeMonitor(monitor) });
}

async function getMonitorChecks(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  monitorId: string,
) {
  const tenantId = extractTenantId(event);
  const monitor = await getMonitorItem(tenantId, monitorId);
  assertOwnership(monitor.tenantId, tenantId);

  const limit = parseInt(event.queryStringParameters?.['limit'] ?? '100', 10);

  const result = await ddb.send(
    new QueryCommand({
      TableName: CHECKS_TABLE,
      IndexName: 'MonitorTimeIndex',
      KeyConditionExpression: 'monitorId = :mid',
      ExpressionAttributeValues: { ':mid': monitorId },
      ScanIndexForward: false, // newest first
      Limit: Math.min(limit, 500),
    }),
  );

  return respond(200, { checks: result.Items ?? [] });
}

async function getMonitorUptime(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  monitorId: string,
) {
  const tenantId = extractTenantId(event);
  const monitor = await getMonitorItem(tenantId, monitorId);
  assertOwnership(monitor.tenantId, tenantId);

  const days = Math.min(parseInt(event.queryStringParameters?.['days'] ?? '30', 10), 90);
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const allItems: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: CHECKS_TABLE,
        IndexName: 'MonitorTimeIndex',
        KeyConditionExpression: 'monitorId = :mid AND checkedAt >= :from',
        ExpressionAttributeValues: { ':mid': monitorId, ':from': fromDate },
        ScanIndexForward: true,
        ExclusiveStartKey: lastKey,
      }),
    );
    allItems.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  const byDay = new Map<string, { checks: number; successes: number; latencies: number[] }>();
  for (const item of allItems) {
    const date = (item['checkedAt'] as string).slice(0, 10);
    if (!byDay.has(date)) byDay.set(date, { checks: 0, successes: 0, latencies: [] });
    const d = byDay.get(date)!;
    d.checks++;
    if (item['success']) d.successes++;
    d.latencies.push(item['latencyMs'] as number);
  }

  const dayEntries = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      checks: d.checks,
      successes: d.successes,
      uptime: d.checks > 0 ? Math.round((d.successes / d.checks) * 1000) / 10 : null,
      avgLatency:
        d.latencies.length > 0
          ? Math.round(d.latencies.reduce((s, v) => s + v, 0) / d.latencies.length)
          : null,
    }));

  const totalChecks = allItems.length;
  const totalSuccesses = allItems.filter((i) => i['success']).length;
  const allLatencies = allItems.map((i) => i['latencyMs'] as number);

  return respond(200, {
    days: dayEntries,
    overall: {
      uptime: totalChecks > 0 ? Math.round((totalSuccesses / totalChecks) * 1000) / 10 : null,
      avgLatency:
        allLatencies.length > 0
          ? Math.round(allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length)
          : null,
      totalChecks,
    },
  });
}

async function updateMonitor(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  monitorId: string,
) {
  const tenantId = extractTenantId(event);
  const monitor = await getMonitorItem(tenantId, monitorId);
  assertOwnership(monitor.tenantId, tenantId);

  const body = updateMonitorSchema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!body.success) throw new HttpError(400, body.error.errors[0].message);

  const updates: string[] = ['updatedAt = :now'];
  const values: Record<string, unknown> = { ':now': new Date().toISOString() };

  const fieldMap: Record<string, string> = {
    name: ':name',
    url: ':url',
    method: ':method',
    expectedStatus: ':expected',
    timeoutMs: ':timeout',
  };

  for (const [field, placeholder] of Object.entries(fieldMap)) {
    const val = (body.data as Record<string, unknown>)[field];
    if (val !== undefined) {
      updates.push(`${field} = ${placeholder}`);
      values[placeholder] = val;
    }
  }

  if (body.data.enabled !== undefined) {
    updates.push('enabled = :enabled');
    values[':enabled'] = body.data.enabled ? 'true' : 'false';
  }

  await ddb.send(
    new UpdateCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: `MONITOR#${monitorId}` },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeValues: values,
    }),
  );

  const updated = await getMonitorItem(tenantId, monitorId);
  return respond(200, { monitor: sanitizeMonitor(updated) });
}

async function deleteMonitor(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  monitorId: string,
) {
  const tenantId = extractTenantId(event);
  const monitor = await getMonitorItem(tenantId, monitorId);
  assertOwnership(monitor.tenantId, tenantId);

  await ddb.send(
    new DeleteCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: `MONITOR#${monitorId}` },
    }),
  );

  return respond(204, null);
}

async function getMonitorItem(tenantId: string, monitorId: string): Promise<Monitor> {
  const result = await ddb.send(
    new GetCommand({
      TableName: MAIN_TABLE,
      Key: { PK: `ORG#${tenantId}`, SK: `MONITOR#${monitorId}` },
    }),
  );
  if (!result.Item) throw new HttpError(404, 'Monitor not found');
  return result.Item as Monitor;
}

function assertOwnership(itemTenantId: string, callerTenantId: string) {
  if (itemTenantId !== callerTenantId) throw new HttpError(403, 'Forbidden');
}

function sanitizeMonitor(m: Monitor) {
  return {
    monitorId: m.monitorId,
    name: m.name,
    url: m.url,
    method: m.method,
    expectedStatus: m.expectedStatus,
    timeoutMs: m.timeoutMs,
    currentStatus: m.currentStatus,
    lastCheckedAt: m.lastCheckedAt,
    createdAt: m.createdAt,
    enabled: m.enabled === 'true',
  };
}
