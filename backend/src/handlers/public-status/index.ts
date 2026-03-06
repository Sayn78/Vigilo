import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, MAIN_TABLE, CHECKS_TABLE } from '../../shared/db/client';
import { respond } from '../../shared/errors/handler-wrapper';
import { HttpError } from '../../shared/errors/http-error';
import type { Monitor, Incident, MonitorStatus } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const slug = event.pathParameters?.['slug'];
  if (!slug) return respond(400, { error: 'Missing slug' });

  const isHistory = event.rawPath.endsWith('/history');

  try {
    const tenantId = await resolveTenantId(slug);

    if (isHistory) {
      return await getHistory(tenantId, event);
    }
    return await getStatus(tenantId, slug, event);
  } catch (err) {
    if (err instanceof HttpError) return respond(err.statusCode, { error: err.message });
    console.error(err);
    return respond(500, { error: 'Internal server error' });
  }
};

async function getStatus(tenantId: string, slug: string, event: APIGatewayProxyEventV2) {
  // Fetch org (public fields only)
  const orgResult = await ddb.send(
    new GetCommand({ TableName: MAIN_TABLE, Key: { PK: `ORG#${tenantId}`, SK: 'METADATA' } }),
  );
  if (!orgResult.Item) throw new HttpError(404, 'Status page not found');

  const org = orgResult.Item;

  // Fetch monitors
  const monitorsResult = await ddb.send(
    new QueryCommand({
      TableName: MAIN_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `ORG#${tenantId}`, ':prefix': 'MONITOR#' },
    }),
  );
  const monitors = (monitorsResult.Items ?? []).filter(
    (m) => m.enabled === 'true',
  ) as Monitor[];

  // Fetch uptime data for each monitor (last 90 checks)
  const monitorsWithUptime = await Promise.all(
    monitors.map(async (m) => {
      const checks = await ddb.send(
        new QueryCommand({
          TableName: CHECKS_TABLE,
          IndexName: 'MonitorTimeIndex',
          KeyConditionExpression: 'monitorId = :mid',
          ExpressionAttributeValues: { ':mid': m.monitorId },
          ScanIndexForward: false,
          Limit: 90,
        }),
      );

      const items = checks.Items ?? [];
      const uptime =
        items.length === 0
          ? null
          : Math.round((items.filter((c) => c.success).length / items.length) * 10000) / 100;

      return {
        monitorId: m.monitorId,
        name: m.name,
        url: m.url,
        currentStatus: m.currentStatus,
        lastCheckedAt: m.lastCheckedAt,
        uptimePercent: uptime,
        recentChecks: items.slice(0, 30).map((c) => ({
          checkedAt: c.checkedAt,
          success: c.success,
          latencyMs: c.latencyMs,
        })),
      };
    }),
  );

  // Fetch active incidents
  const incidentsResult = await ddb.send(
    new QueryCommand({
      TableName: MAIN_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `ORG#${tenantId}`, ':prefix': 'INCIDENT#' },
      ScanIndexForward: false,
      Limit: 10,
    }),
  );
  const activeIncidents = ((incidentsResult.Items ?? []) as Incident[]).filter(
    (i) => i.status !== 'resolved',
  );

  // Overall status: worst of all monitors
  const overallStatus = deriveOverallStatus(monitors.map((m) => m.currentStatus));

  const responseHeaders: Record<string, string> = {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
  };

  return respond(
    200,
    {
      org: { name: org.name, slug: org.slug },
      overallStatus,
      monitors: monitorsWithUptime,
      activeIncidents: activeIncidents.map(sanitizeIncident),
    },
    responseHeaders,
  );
}

async function getHistory(tenantId: string, event: APIGatewayProxyEventV2) {
  const limit = parseInt(event.queryStringParameters?.['limit'] ?? '20', 10);

  const result = await ddb.send(
    new QueryCommand({
      TableName: MAIN_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `ORG#${tenantId}`, ':prefix': 'INCIDENT#' },
      ScanIndexForward: false,
      Limit: Math.min(limit, 50),
    }),
  );

  const headers: Record<string, string> = {
    'Cache-Control': 'public, max-age=120',
  };

  return respond(200, { incidents: ((result.Items ?? []) as Incident[]).map(sanitizeIncident) }, headers);
}

async function resolveTenantId(slug: string): Promise<string> {
  const result = await ddb.send(
    new GetCommand({ TableName: MAIN_TABLE, Key: { PK: `SLUG#${slug}`, SK: 'METADATA' } }),
  );
  if (!result.Item) throw new HttpError(404, 'Status page not found');
  return result.Item.tenantId as string;
}

function deriveOverallStatus(statuses: MonitorStatus[]): MonitorStatus {
  if (statuses.includes('outage')) return 'outage';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.every((s) => s === 'operational')) return 'operational';
  return 'unknown';
}

function sanitizeIncident(i: Incident) {
  return {
    incidentId: i.incidentId,
    title: i.title,
    status: i.status,
    impact: i.impact,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    resolvedAt: i.resolvedAt,
  };
}
