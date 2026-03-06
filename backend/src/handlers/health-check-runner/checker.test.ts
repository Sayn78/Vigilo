import { runWithConcurrencyLimit } from './checker';

describe('runWithConcurrencyLimit', () => {
  it('runs all tasks and returns results', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];

    const results = await runWithConcurrencyLimit(tasks, 2);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('handles task failures without stopping other tasks', async () => {
    const tasks = [
      () => Promise.resolve('ok'),
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve('ok2'),
    ];

    const results = await runWithConcurrencyLimit(tasks, 2);

    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('respects concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 6 }, () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
    });

    await runWithConcurrencyLimit(tasks, 3);

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });
});
