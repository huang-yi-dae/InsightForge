import { describe, it, expect } from "vitest";
import { computeWritingStreak } from "./streak";

// 固定「现在」为本地 2026-08-10 12:00，构造相对日期便于断言
const NOW = new Date(2026, 7, 10, 12, 0, 0);

function daysAgo(n: number, hour = 9): string {
  const d = new Date(2026, 7, 10 - n, hour, 0, 0);
  return d.toISOString();
}

describe("computeWritingStreak", () => {
  it("无任何发布 → 0", () => {
    expect(computeWritingStreak([], NOW)).toEqual({ current: 0, publishedToday: false });
  });

  it("今天发布 → streak=1, publishedToday=true", () => {
    expect(computeWritingStreak([daysAgo(0)], NOW)).toEqual({ current: 1, publishedToday: true });
  });

  it("今天+昨天+前天连续 → streak=3", () => {
    const r = computeWritingStreak([daysAgo(0), daysAgo(1), daysAgo(2)], NOW);
    expect(r).toEqual({ current: 3, publishedToday: true });
  });

  it("同一天多篇只算一天", () => {
    const r = computeWritingStreak([daysAgo(0, 8), daysAgo(0, 20), daysAgo(1)], NOW);
    expect(r).toEqual({ current: 2, publishedToday: true });
  });

  it("今天没写但昨天写了 → streak 从昨天续，publishedToday=false", () => {
    const r = computeWritingStreak([daysAgo(1), daysAgo(2)], NOW);
    expect(r).toEqual({ current: 2, publishedToday: false });
  });

  it("今天和昨天都没写 → 断掉归零", () => {
    const r = computeWritingStreak([daysAgo(2), daysAgo(3)], NOW);
    expect(r).toEqual({ current: 0, publishedToday: false });
  });

  it("中间断一天 → 只数到断点", () => {
    // 今天、昨天有，前天没有，大前天有 → 连续只到昨天=2
    const r = computeWritingStreak([daysAgo(0), daysAgo(1), daysAgo(3)], NOW);
    expect(r).toEqual({ current: 2, publishedToday: true });
  });

  it("忽略非法日期", () => {
    const r = computeWritingStreak(["not-a-date", daysAgo(0)], NOW);
    expect(r).toEqual({ current: 1, publishedToday: true });
  });
});
