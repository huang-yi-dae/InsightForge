import { describe, it, expect, beforeEach } from "vitest";
import {
  hitRateLimit,
  clientKeyFromHeaders,
  tooManyRequests,
  __resetRateLimitForTest,
} from "./rate-limit";

const RULE = { limit: 3, windowMs: 10_000 };

describe("hitRateLimit", () => {
  beforeEach(() => __resetRateLimitForTest());

  it("窗口内前 N 次放行，剩余数递减", () => {
    const t = 1_000_000;
    expect(hitRateLimit("a", RULE, t)).toMatchObject({ ok: true, remaining: 2 });
    expect(hitRateLimit("a", RULE, t + 1)).toMatchObject({ ok: true, remaining: 1 });
    expect(hitRateLimit("a", RULE, t + 2)).toMatchObject({ ok: true, remaining: 0 });
  });

  it("超过上限即拒绝并给出 Retry-After 秒数", () => {
    const t = 1_000_000;
    hitRateLimit("a", RULE, t);
    hitRateLimit("a", RULE, t + 1);
    hitRateLimit("a", RULE, t + 2);
    const r = hitRateLimit("a", RULE, t + 3);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(r.retryAfterSec).toBeLessThanOrEqual(10);
  });

  it("最早一次滑出窗口后恢复放行", () => {
    const t = 1_000_000;
    hitRateLimit("a", RULE, t);
    hitRateLimit("a", RULE, t + 1);
    hitRateLimit("a", RULE, t + 2);
    expect(hitRateLimit("a", RULE, t + 3).ok).toBe(false);
    // 第一次(t)在 t+windowMs 之后滑出 -> 放行
    expect(hitRateLimit("a", RULE, t + 10_001).ok).toBe(true);
  });

  it("不同 key 相互隔离", () => {
    const t = 1_000_000;
    hitRateLimit("a", RULE, t);
    hitRateLimit("a", RULE, t);
    hitRateLimit("a", RULE, t);
    expect(hitRateLimit("a", RULE, t).ok).toBe(false);
    // b 桶不受 a 影响
    expect(hitRateLimit("b", RULE, t).ok).toBe(true);
  });

  it("超限后持续重试不会刷穿窗口（失败也计入不追加，earliest 不被推后）", () => {
    const t = 1_000_000;
    hitRateLimit("a", RULE, t);
    hitRateLimit("a", RULE, t);
    hitRateLimit("a", RULE, t);
    // 在 t+5000 反复重试
    for (let i = 0; i < 5; i++) hitRateLimit("a", RULE, t + 5000 + i);
    // 到 t+9999 仍应被拒（最早一次 t 尚未滑出）
    expect(hitRateLimit("a", RULE, t + 9999).ok).toBe(false);
    // t+10001 后最早一次滑出 -> 放行
    expect(hitRateLimit("a", RULE, t + 10_001).ok).toBe(true);
  });
});

describe("clientKeyFromHeaders", () => {
  it("优先取 x-forwarded-for 首段", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "x-real-ip": "10.0.0.1" });
    expect(clientKeyFromHeaders(h, "skeleton")).toBe("skeleton:203.0.113.9");
  });

  it("无 xff 时回退 x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(clientKeyFromHeaders(h, "discover")).toBe("discover:198.51.100.7");
  });

  it("都没有时回退 unknown（全局桶）", () => {
    expect(clientKeyFromHeaders(new Headers(), "expand")).toBe("expand:unknown");
  });
});

describe("tooManyRequests", () => {
  it("返回 429 且带 Retry-After / 限流头", async () => {
    const res = tooManyRequests({ ok: false, remaining: 0, retryAfterSec: 7, limit: 3 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("7");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
    const body = await res.json();
    expect(body.code).toBe("rate_limited");
  });
});
