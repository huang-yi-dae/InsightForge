import { describe, it, expect } from "vitest";
import { observeWritings, proposeIdentityUpdates, applyProposal } from "./identity-memory";
import type { Identity, Writing } from "./types";

const w = (id: string, title: string, userWords: number, aiWords = 0): Writing => ({
  id,
  draftId: `d-${id}`,
  gapId: `g-${id}`,
  title,
  content: "x",
  userWords,
  aiWords,
  publishedAt: "2026-08-01T00:00:00.000Z",
  reflowed: true,
});

const idn = (over: Partial<Identity> = {}): Identity => ({
  pointOfView: "",
  audience: "",
  voice: "",
  topics: "",
  ...over,
});

describe("observeWritings", () => {
  it("按标题聚合高频话题、剔除停用词", () => {
    const obs = observeWritings([
      w("a", "关于 写作 的思考", 100),
      w("b", "写作 与 焦虑", 100),
      w("c", "写作 工具", 100),
    ]);
    expect(obs.topTopics[0].term).toBe("写作");
    expect(obs.topTopics[0].count).toBe(3);
    expect(obs.topTopics.some((t) => t.term === "的")).toBe(false);
  });

  it("平均人工占比", () => {
    const obs = observeWritings([w("a", "x", 80, 20), w("b", "y", 60, 40)]);
    expect(obs.avgHumanRatio).toBeCloseTo(0.7);
  });
});

describe("proposeIdentityUpdates", () => {
  it("样本不足时不提议", () => {
    const obs = observeWritings([w("a", "写作 写作", 100)]);
    expect(proposeIdentityUpdates(idn(), obs)).toEqual([]);
  });

  it("把高频且未记录的话题建议追加，去重已有的", () => {
    const ws = [w("a", "写作 焦虑", 100), w("b", "写作 焦虑", 100), w("c", "写作 焦虑", 100)];
    const obs = observeWritings(ws);
    const ps = proposeIdentityUpdates(idn({ topics: "写作" }), obs);
    const topic = ps.find((p) => p.field === "topics")!;
    expect(topic.added).toContain("焦虑");
    expect(topic.added).not.toContain("写作"); // 已有的不重复建议
    expect(topic.nextValue).toContain("写作");
    expect(topic.nextValue).toContain("焦虑");
  });

  it("人工占比高时建议补 voice，且不重复追加", () => {
    const ws = [w("a", "t", 100), w("b", "t", 100), w("c", "t", 100)];
    const obs = observeWritings(ws);
    const ps = proposeIdentityUpdates(idn(), obs);
    const voice = ps.find((p) => p.field === "voice");
    expect(voice).toBeTruthy();
    // 已含该标签则不再提议
    const ps2 = proposeIdentityUpdates(idn({ voice: voice!.nextValue }), obs);
    expect(ps2.find((p) => p.field === "voice")).toBeUndefined();
  });
});

describe("applyProposal", () => {
  it("返回目标字段的部分更新", () => {
    const ws = [w("a", "写作 焦虑", 100), w("b", "写作 焦虑", 100), w("c", "写作 焦虑", 100)];
    const [p] = proposeIdentityUpdates(idn(), observeWritings(ws));
    const patch = applyProposal(p);
    expect(patch[p.field]).toBe(p.nextValue);
  });
});
