// Per-instance guardrail; use an edge/shared store for multi-instance production deployments.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now(); let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  return { allowed: b.count <= limit, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
}
export function clientIp(req: Request) { return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }
