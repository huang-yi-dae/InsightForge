// 轻量内存滑动窗口限流器 —— 用于 LLM 代转路由的第一道滥用防线（开放代理防护）。
//
// 设计取舍：
// - 零外部依赖，纯内存 Map；对 serverless 单实例 / 单进程有效。跨实例不共享
//   状态（横向扩容时每实例各自计数），因此它是「尽力而为的成本护栏」，不是强一致配额。
//   若未来需要跨实例强配额，应换 Redis/Upstash；接口保持不变即可平滑替换。
// - 滑动窗口用时间戳数组，精确到毫秒；每次命中顺带惰性清理过期时间戳，避免内存无界增长。
// - 键默认取客户端 IP（经 x-forwarded-for / x-real-ip），拿不到时回退到固定桶，
//   宁可全局限流也不放行无界匿名流量。

export interface RateLimitRule {
  /** 窗口内允许的最大请求数 */
  limit: number;
  /** 窗口时长（毫秒） */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** 本窗口剩余可用次数（已扣减当前这次） */
  remaining: number;
  /** 距离可再次尝试的秒数（仅 ok=false 时有意义，用于 Retry-After） */
  retryAfterSec: number;
  limit: number;
}

// key -> 命中时间戳（毫秒）升序数组
const buckets = new Map<string, number[]>();

// 防止 Map 在极端情况下无界增长：超过阈值时清掉一批已完全过期的桶。
const MAX_BUCKETS = 10_000;

function sweepIfNeeded(now: number, windowMs: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [k, stamps] of buckets) {
    if (stamps.length === 0 || stamps[stamps.length - 1] <= now - windowMs) {
      buckets.delete(k);
    }
  }
}

/**
 * 记录一次命中并判断是否超限。原子式：命中即计数（失败也计数，避免超限后无限重试刷穿窗口）。
 */
export function hitRateLimit(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
  const { limit, windowMs } = rule;
  const windowStart = now - windowMs;

  const prev = buckets.get(key) ?? [];
  // 惰性清理窗口外的旧时间戳
  let firstValid = 0;
  while (firstValid < prev.length && prev[firstValid] <= windowStart) firstValid++;
  const stamps = firstValid > 0 ? prev.slice(firstValid) : prev;

  if (stamps.length >= limit) {
    // 已达上限：不再追加，计算需等待到最早那次滑出窗口的时间
    const earliest = stamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));
    buckets.set(key, stamps);
    return { ok: false, remaining: 0, retryAfterSec, limit };
  }

  stamps.push(now);
  buckets.set(key, stamps);
  sweepIfNeeded(now, windowMs);
  return { ok: true, remaining: Math.max(0, limit - stamps.length), retryAfterSec: 0, limit };
}

/**
 * 从请求头提取客户端标识。优先 x-forwarded-for 的首段（最靠近客户端的公网 IP），
 * 回退 x-real-ip；都没有则回退固定桶名（宁可全局限流）。
 */
export function clientKeyFromHeaders(headers: Headers, scope: string): string {
  const xff = headers.get("x-forwarded-for");
  const ip =
    (xff ? xff.split(",")[0]?.trim() : "") ||
    headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `${scope}:${ip}`;
}

/** ok=false 时构造标准 429 响应（带 Retry-After 与限流头）。 */
export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { code: "rate_limited", message: "请求过于频繁，请稍后再试。" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/** 仅供测试：清空全部计数桶。 */
export function __resetRateLimitForTest(): void {
  buckets.clear();
}
