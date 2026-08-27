import { describe, expect, it } from 'vitest';
import { getRequestMetrics, recordRequest, recordRequestDuration, recordDatabaseQuery, getDatabaseMetrics } from './metrics';

describe('request metrics', () => {
  it('tracks requests and calculates a recent rate', () => {
    const before = getRequestMetrics().totalTracked;
    recordRequest('GET', '/api/health');
    const after = getRequestMetrics();
    expect(after.totalTracked).toBeGreaterThan(before);
    expect(after.requestsLastMinute).toBeGreaterThan(0);
    expect(after.requestsPerSecond).toBeGreaterThanOrEqual(0);
  });

  it('tracks request latency without allowing negative values', () => {
    recordRequestDuration('GET', '/api/health', -10);
    expect(getRequestMetrics().averageLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('tracks database latency and failures', () => {
    recordDatabaseQuery(12);
    recordDatabaseQuery(25, true);
    const metrics = getDatabaseMetrics();
    expect(metrics.queriesLastMinute).toBeGreaterThanOrEqual(2);
    expect(metrics.failuresLastMinute).toBeGreaterThanOrEqual(1);
    expect(metrics.averageLatencyMs).toBeGreaterThan(0);
  });
});
