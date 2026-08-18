import { describe, it, expect } from "vitest";
import { rankGapsByIdentity } from "./gap-ranking";
import type { Gap, Identity } from "./types";

const gap = (id: string, title: string, confidence: number): Gap => ({
  id,
  title,
  confidence,
  clusterIds: [],
  supportingFragmentIds: [],
  status: "todo",
});

const idn = (over: Partial<Identity> = {}): Identity => ({
  pointOfView: "",
  audience: "",
  voice: "",
  topics: "",
  ...over,
});

describe("rankGapsByIdentity", () => {
  it("命中深耕话题的选题被抬升到前面", () => {
    const gaps = [gap("a", "关于旅行的随笔", 0.7), gap("b", "写作与焦虑", 0.6)];
    const r = rankGapsByIdentity(gaps, idn({ topics: "写作，焦虑" }));
    expect(r[0].gap.id).toBe("b");
    expect(r[0].matched).toEqual(expect.arrayContaining(["写作", "焦虑"]));
  });

  it("身份为空时按 confidence 排序", () => {
    const gaps = [gap("a", "低", 0.5), gap("b", "高", 0.9)];
    const r = rankGapsByIdentity(gaps, idn());
    expect(r.map((x) => x.gap.id)).toEqual(["b", "a"]);
    expect(r.every((x) => x.matched.length === 0)).toBe(true);
  });

  it("也会消费观点/立场里的关键词", () => {
    const gaps = [gap("a", "极简主义生活", 0.6), gap("b", "别的话题", 0.6)];
    const r = rankGapsByIdentity(gaps, idn({ pointOfView: "极简主义" }));
    expect(r[0].gap.id).toBe("a");
    expect(r[0].matched).toContain("极简主义");
  });

  it("命中加权封顶，不至于碾压 confidence 差距过大者的稳定排序", () => {
    const gaps = [gap("a", "写作 写作 写作", 0.4), gap("b", "无关", 0.95)];
    const r = rankGapsByIdentity(gaps, idn({ topics: "写作" }));
    // a 命中 1 个关键词（去重后）加 0.15 => 0.55 < 0.95
    expect(r[0].gap.id).toBe("b");
  });
});
