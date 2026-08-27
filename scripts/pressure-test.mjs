#!/usr/bin/env node

const baseUrl = process.env.PRESSURE_URL || 'http://localhost:60824/api/health';
const concurrency = Math.max(1, Number(process.env.PRESSURE_CONCURRENCY || 10));
const durationMs = Math.max(1000, Number(process.env.PRESSURE_DURATION_MS || 10000));
const startedAt = Date.now();
let total = 0;
let failures = 0;
let totalLatency = 0;

async function worker() {
  while (Date.now() - startedAt < durationMs) {
    const requestStarted = Date.now();
    try {
      const response = await fetch(baseUrl, { headers: { 'cache-control': 'no-cache' } });
      total += 1;
      totalLatency += Date.now() - requestStarted;
      if (!response.ok) failures += 1;
    } catch {
      total += 1;
      failures += 1;
      totalLatency += Date.now() - requestStarted;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
const elapsed = Math.max(1, Date.now() - startedAt);
console.log(JSON.stringify({
  url: baseUrl,
  concurrency,
  durationMs: elapsed,
  requests: total,
  failures,
  requestsPerSecond: Number((total * 1000 / elapsed).toFixed(2)),
  averageLatencyMs: Number((totalLatency / Math.max(1, total)).toFixed(2)),
}, null, 2));
if (failures > 0) process.exitCode = 1;
