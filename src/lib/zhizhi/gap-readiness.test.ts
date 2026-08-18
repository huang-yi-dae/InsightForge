import { describe, it, expect } from "vitest";
import { assessGapReadiness } from "./gap-readiness";
import type { Fragment, Gap } from "./types";

const NOW = new Date(2026, 7, 10, 12, 0, 0); // 2026-08-10

const gap = (supportIds: string[], confidence = 0.6): Gap => ({
  id: "g1",
  title: "选题",
  confidence,
  clusterIds: ["c1"],
  supportingFragmentIds: supportIds,
  status: "todo",
});

const frag = (id: string, daysAgo: number): Fragment => ({
  id,
  clusterId: "c1",
  source: "raw",
  content: "x",
  createdAt: new Date(NOW.getTime() - daysAgo * 24 * 3600 * 1000).toISOString(),
});

describe("assessGapReadiness", () => {
  it("证据不足（<3）标记为 thin", () => {
    const r = assessGapReadiness(gap(["f1", "f2"]), [frag("f1", 1), frag("f2", 1)], NOW);
    expect(r.level).toBe("thin");
    expect(r.reasonKey).toBe("thinFewEvidence");
    expect(r.evidence).toBe(2);
  });

  it("证据足且有近 7 天新素材 → ready + readyFresh", () => {
    const fs = [frag("f1", 1), frag("f2", 2), frag("f3", 3)];
    const r = assessGapReadiness(gap(["f1", "f2", "f3"]), fs, NOW);
    expect(r.level).toBe("ready");
    expect(r.reasonKey).toBe("readyFresh");
    expect(r.fresh).toBe(3);
  });

  it("证据足但都不新 → ready + readySolid", () => {
    const fs = [frag("f1", 30), frag("f2", 40), frag("f3", 50)];
    const r = assessGapReadiness(gap(["f1", "f2", "f3"]), fs, NOW);
    expect(r.level).toBe("ready");
    expect(r.reasonKey).toBe("readySolid");
    expect(r.fresh).toBe(0);
  });

  it("只统计属于该选题的支撑碎片", () => {
    const fs = [frag("f1", 1), frag("f2", 1), frag("f3", 1), frag("other", 1)];
    const r = assessGapReadiness(gap(["f1", "f2", "f3"]), fs, NOW);
    expect(r.evidence).toBe(3);
    expect(r.fresh).toBe(3); // other 不计入
  });
});
