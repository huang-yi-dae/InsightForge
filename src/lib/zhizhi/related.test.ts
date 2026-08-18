import { describe, it, expect } from "vitest";
import { relatedWritings } from "./related";
import type { Gap, Writing } from "./types";

const gap = (id: string, clusterIds: string[], frags: string[]): Gap => ({
  id,
  title: `gap-${id}`,
  confidence: 0.8,
  clusterIds,
  supportingFragmentIds: frags,
  status: "published",
});

const writing = (id: string, gapId: string): Writing => ({
  id,
  draftId: `d-${id}`,
  gapId,
  title: `w-${id}`,
  content: "…",
  userWords: 100,
  aiWords: 10,
  publishedAt: "2026-08-01T00:00:00.000Z",
  reflowed: true,
});

describe("relatedWritings", () => {
  const gaps = [
    gap("g1", ["c1", "c2"], ["f1", "f2"]),
    gap("g2", ["c1"], ["f9"]), // 与 g1 共享簇 c1
    gap("g3", ["c9"], ["f2"]), // 与 g1 共享碎片 f2
    gap("g4", ["c9"], ["f8"]), // 与 g1 无交集
    gap("g5", ["c1", "c2"], ["f1"]), // 与 g1 共享两簇 + 一碎片（最相关）
  ];
  const ws = [
    writing("w1", "g1"),
    writing("w2", "g2"),
    writing("w3", "g3"),
    writing("w4", "g4"),
    writing("w5", "g5"),
  ];
  const target = ws[0];

  it("排除自身", () => {
    const r = relatedWritings(target, ws, gaps);
    expect(r.some((x) => x.writing.id === "w1")).toBe(false);
  });

  it("无交集的不返回", () => {
    const r = relatedWritings(target, ws, gaps);
    expect(r.some((x) => x.writing.id === "w4")).toBe(false);
  });

  it("按得分降序：w5(2簇+1碎=5) > w2(1簇=2) ≈ w3(1碎=1)", () => {
    const r = relatedWritings(target, ws, gaps);
    expect(r[0].writing.id).toBe("w5");
    expect(r[0].score).toBe(5);
    // w2 得分2 应排在 w3 得分1 之前
    const ids = r.map((x) => x.writing.id);
    expect(ids.indexOf("w2")).toBeLessThan(ids.indexOf("w3"));
  });

  it("给出共享簇/碎片计数", () => {
    const r = relatedWritings(target, ws, gaps);
    const w5 = r.find((x) => x.writing.id === "w5")!;
    expect(w5.sharedClusters).toBe(2);
    expect(w5.sharedFragments).toBe(1);
  });

  it("目标无 gap → 空", () => {
    const orphan = writing("wx", "nope");
    expect(relatedWritings(orphan, ws, gaps)).toEqual([]);
  });

  it("limit 生效", () => {
    const r = relatedWritings(target, ws, gaps, 1);
    expect(r).toHaveLength(1);
    expect(r[0].writing.id).toBe("w5");
  });
});
