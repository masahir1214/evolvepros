// Small in-memory sliding-window limiter for login/setup attempts. It protects a single
// server instance; put a shared store (e.g. Redis) behind it if you run several replicas.
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((time) => now - time < windowMs);
  buckets.set(key, bucket);
  if (bucket.hits.length >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - bucket.hits[0])) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailure(key: string): void {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits.push(Date.now());
  buckets.set(key, bucket);
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

// Keep the map from growing without bound.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, bucket] of buckets) {
    if (!bucket.hits.some((time) => time > cutoff)) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

// Counts one use against the limit; returns allowed=false (without counting) once the window is full.
export function consumeRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const result = checkRateLimit(key, limit, windowMs);
  if (result.allowed) recordFailure(key);
  return result;
}
