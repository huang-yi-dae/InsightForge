import { describe, it, expect } from "vitest";
import { weeklyWordSeries, earnedBadges, summarizeWritings } from "./metrics";
import type { Writing } from "./types";

const w = (id: string, publishedAt: string, userWords: number, aiWords = 0): Writing => ({
  id,
  draftId: `d-${id}`,
  gapId: `g-${id}`,
  title: id,
  content: "x",
  userWords,
  aiWords,
  publishedAt,
  reflowed: true,
});

const NOW = new Date(2026, 7, 10, 12, 0, 0); // 2026-08-10 周一

describe("weeklyWordSeries", () => {
  it("返回 7 天、今天在末尾并标记", () => {
    const s = weeklyWordSeries([], NOW);
    expect(s).toHaveLength(7);
    expect(s[6].isToday).toBe(true);
    expect(s.slice(0, 6).every((d) => !d.isToday)).toBe(true);
  });

  it("按发布日聚合 user+ai 字数", () => {
    const s = weeklyWordSeries(
      [w("a", NOW.toISOString(), 100, 20), w("b", NOW.toISOString(), 30)],
      NOW,
    );
    expect(s[6].words).toBe(150);
  });

  it("窗口外的成文不计入", () => {
    const old = new Date(2026, 6, 1).toISOString();
    const s = weeklyWordSeries([w("a", old, 999)], NOW);
    expect(s.reduce((n, d) => n + d.words, 0)).toBe(0);
  });
});

describe("earnedBadges", () => {
  it("首篇/连续/字数里程碑判定", () => {
    const b = earnedBadges({ totalWords: 12000, publishedCount: 3, streak: 4 });
    const by = Object.fromEntries(b.map((x) => [x.id, x]));
    expect(by.firstPiece.earned).toBe(true);
    expect(by.tenPieces.earned).toBe(false);
    expect(by.streak3.earned).toBe(true);
    expect(by.streak7.earned).toBe(false);
    expect(by.words10k.earned).toBe(true);
    expect(by.words50k.earned).toBe(false);
  });

  it("未解锁徽章带 0..1 进度", () => {
    const b = earnedBadges({ totalWords: 5000, publishedCount: 0, streak: 0 });
    expect(b.find((x) => x.id === "words10k")!.progress).toBeCloseTo(0.5);
    expect(b.find((x) => x.id === "firstPiece")!.progress).toBe(0);
  });
});

describe("summarizeWritings", () => {
  it("累计字数与篇数", () => {
    const r = summarizeWritings([w("a", NOW.toISOString(), 100, 10), w("b", NOW.toISOString(), 40)]);
    expect(r).toEqual({ totalWords: 150, publishedCount: 2 });
  });
});
