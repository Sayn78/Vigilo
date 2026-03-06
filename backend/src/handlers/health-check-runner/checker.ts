import type { CheckResult, Monitor } from '../../shared/types';

/**
 * Performs an HTTP health check for a single monitor.
 * Isolated in its own module for testability.
 */
export async function checkMonitor(monitor: Monitor): Promise<CheckResult> {
  const startTime = Date.now();
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), monitor.timeoutMs);

    const response = await fetch(monitor.url, {
      method: monitor.method,
      signal: controller.signal,
      headers: { 'User-Agent': 'StatusPage-HealthChecker/1.0' },
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    const success = response.status === monitor.expectedStatus;

    return {
      monitorId: monitor.monitorId,
      tenantId: monitor.tenantId,
      checkedAt: new Date().toISOString(),
      statusCode: response.status,
      latencyMs,
      success,
      error: success ? undefined : `Expected ${monitor.expectedStatus}, got ${response.status}`,
      ttl,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const error = err instanceof Error ? err.message : 'Unknown error';

    return {
      monitorId: monitor.monitorId,
      tenantId: monitor.tenantId,
      checkedAt: new Date().toISOString(),
      statusCode: null,
      latencyMs,
      success: false,
      error,
      ttl,
    };
  }
}

/**
 * Runs tasks with a concurrency limit (prevent Lambda network exhaustion).
 */
export async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const queue = [...tasks];
  const active = new Set<Promise<void>>();

  while (queue.length > 0 || active.size > 0) {
    while (queue.length > 0 && active.size < limit) {
      const task = queue.shift()!;
      const p: Promise<void> = task().then(
        (value) => { results.push({ status: 'fulfilled', value }); },
        (reason) => { results.push({ status: 'rejected', reason }); },
      ).finally(() => { active.delete(p); });
      active.add(p);
    }
    if (active.size > 0) await Promise.race(active);
  }

  return results;
}
