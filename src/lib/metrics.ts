type RequestMetric = { at: number; method: string; path: string; durationMs?: number };
const recent: RequestMetric[] = [];
const MAX_ENTRIES = 2000;
const databaseQueries: Array<{ at: number; durationMs: number; failed: boolean }> = [];

export function recordRequest(method: string, path: string) {
  recent.push({ at: Date.now(), method, path });
  if (recent.length > MAX_ENTRIES) recent.splice(0, recent.length - MAX_ENTRIES);
}

export function recordRequestDuration(method: string, path: string, durationMs: number) {
  recent.push({ at: Date.now(), method, path, durationMs: Math.max(0, Math.round(durationMs)) });
  if (recent.length > MAX_ENTRIES) recent.splice(0, recent.length - MAX_ENTRIES);
}

export function getRequestMetrics() {
  const now = Date.now();
  const lastMinute = recent.filter((entry) => entry.at >= now - 60_000);
  return {
    totalTracked: recent.length,
    requestsLastMinute: lastMinute.length,
    requestsPerSecond: Number((lastMinute.length / 60).toFixed(2)),
    averageLatencyMs: lastMinute.length ? Number((lastMinute.reduce((sum, entry) => sum + (entry.durationMs || 0), 0) / lastMinute.length).toFixed(2)) : 0,
  };
}

export function recordDatabaseQuery(durationMs: number, failed = false) {
  databaseQueries.push({ at: Date.now(), durationMs: Math.max(0, Math.round(durationMs)), failed });
  if (databaseQueries.length > MAX_ENTRIES) databaseQueries.splice(0, databaseQueries.length - MAX_ENTRIES);
}

export function getDatabaseMetrics() {
  const now = Date.now();
  const recentQueries = databaseQueries.filter((entry) => entry.at >= now - 60_000);
  return {
    queriesLastMinute: recentQueries.length,
    failuresLastMinute: recentQueries.filter((entry) => entry.failed).length,
    averageLatencyMs: recentQueries.length ? Number((recentQueries.reduce((sum, entry) => sum + entry.durationMs, 0) / recentQueries.length).toFixed(2)) : 0,
  };
}
