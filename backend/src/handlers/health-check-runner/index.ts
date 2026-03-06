import type { ScheduledEvent } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ddb, MAIN_TABLE, CHECKS_TABLE } from '../../shared/db/client';
import type { Monitor, MonitorStatus, Org } from '../../shared/types';
import { checkMonitor, runWithConcurrencyLimit } from './checker';

const sns = new SNSClient({});
const CONCURRENCY_LIMIT = 10;

/**
 * Triggered by EventBridge Scheduler every 5 minutes.
 * Fetches all enabled monitors across all tenants, runs HTTP checks in parallel,
 * writes results to DynamoDB, and sends SNS alerts on status changes.
 */
export const handler = async (_event: ScheduledEvent): Promise<void> => {
  console.log('HealthCheckRunner started');

  // List all enabled monitors via GSI
  const monitors = await listAllEnabledMonitors();
  console.log(`Found ${monitors.length} enabled monitors`);

  if (monitors.length === 0) return;

  // Run checks with concurrency limit
  const tasks = monitors.map((monitor) => () => checkMonitor(monitor));
  const results = await runWithConcurrencyLimit(tasks, CONCURRENCY_LIMIT);

  // Process results
  await Promise.allSettled(
    results.map(async (result, idx) => {
      if (result.status === 'rejected') {
        console.error(`Check failed for monitor ${monitors[idx].monitorId}:`, result.reason);
        return;
      }

      const checkResult = result.value;
      const monitor = monitors[idx];

      // Write check result to time-series table
      await ddb.send(
        new PutCommand({
          TableName: CHECKS_TABLE,
          Item: {
            PK: `MONITOR#${checkResult.monitorId}`,
            SK: `CHECK#${checkResult.checkedAt}`,
            monitorId: checkResult.monitorId,
            tenantId: checkResult.tenantId,
            checkedAt: checkResult.checkedAt,
            statusCode: checkResult.statusCode,
            latencyMs: checkResult.latencyMs,
            success: checkResult.success,
            ...(checkResult.error && { error: checkResult.error }),
            ttl: checkResult.ttl,
          },
        }),
      );

      // Determine new status
      const newStatus: MonitorStatus = checkResult.success
        ? 'operational'
        : checkResult.latencyMs > monitor.timeoutMs * 0.8
        ? 'degraded'
        : 'outage';

      const statusChanged = monitor.currentStatus !== newStatus;

      // Update monitor's current status
      await ddb.send(
        new UpdateCommand({
          TableName: MAIN_TABLE,
          Key: { PK: `ORG#${monitor.tenantId}`, SK: `MONITOR#${monitor.monitorId}` },
          UpdateExpression: 'SET currentStatus = :status, lastCheckedAt = :checked',
          ExpressionAttributeValues: {
            ':status': newStatus,
            ':checked': checkResult.checkedAt,
          },
        }),
      );

      // Notify on status change
      if (statusChanged) {
        console.log(
          `Monitor ${monitor.monitorId} status changed: ${monitor.currentStatus} → ${newStatus}`,
        );
        await notifyStatusChange(monitor, newStatus, checkResult.error);
      }
    }),
  );

  console.log('HealthCheckRunner completed');
};

async function listAllEnabledMonitors(): Promise<Monitor[]> {
  const monitors: Monitor[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: MAIN_TABLE,
        IndexName: 'EnabledMonitorsIndex',
        KeyConditionExpression: 'entityType = :type AND enabled = :enabled',
        ExpressionAttributeValues: { ':type': 'MONITOR', ':enabled': 'true' },
        ExclusiveStartKey: lastKey,
        Limit: 100,
      }),
    );

    monitors.push(...((result.Items ?? []) as Monitor[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return monitors;
}

async function notifyStatusChange(
  monitor: Monitor,
  newStatus: MonitorStatus,
  error?: string,
): Promise<void> {
  try {
    const orgResult = await ddb.send(
      new GetCommand({
        TableName: MAIN_TABLE,
        Key: { PK: `ORG#${monitor.tenantId}`, SK: 'METADATA' },
      }),
    );
    const org = orgResult.Item as Org | undefined;
    if (!org?.snsTopicArn) return;

    const emoji = newStatus === 'operational' ? '✅' : newStatus === 'degraded' ? '⚠️' : '🔴';
    const subject = `${emoji} [Status Page] ${monitor.name} is ${newStatus.toUpperCase()}`;
    const message = [
      `Monitor: ${monitor.name}`,
      `URL: ${monitor.url}`,
      `Previous status: ${monitor.currentStatus}`,
      `New status: ${newStatus}`,
      `Checked at: ${new Date().toISOString()}`,
      error ? `Error: ${error}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await sns.send(
      new PublishCommand({ TopicArn: org.snsTopicArn, Subject: subject, Message: message }),
    );
  } catch (err) {
    console.error('Failed to send SNS notification:', err);
    // Non-fatal
  }
}
