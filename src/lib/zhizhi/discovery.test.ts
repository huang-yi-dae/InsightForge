import { describe, it, expect } from "vitest";
import {
  splitIntoFragments,
  scoreClusterMatch,
  bestClusterFor,
  dedupeSetsFromGaps,
  discoverGaps,
} from "@/lib/zhizhi/discovery";
import type { Cluster, Fragment, Gap } from "@/lib/zhizhi/types";

// 说明：discovery.ts 的这几个函数是发现引擎的公共接口（已确认的 seam）。
// 期望值均为「独立手算的示例」，不复用被测代码的公式，以避免 tautological 反模式。

describe("splitIntoFragments", () => {
  it("按空行与换行分段、去空白、丢弃短于 6 字的片段", () => {
    const text = "这是第一段够长的内容\n短\n\n这是第二段也够长的内容";
    // 三块：'这是第一段够长的内容'(10)、'短'(1，丢弃)、'这是第二段也够长的内容'(11)
    expect(splitIntoFragments(text)).toEqual([
      "这是第一段够长的内容",
      "这是第二段也够长的内容",
    ]);
  });

  it("最多切出 200 条", () => {
    const line = "这是一条足够长的碎片文本";
    const text = Array.from({ length: 300 }, () => line).join("\n");
    expect(splitIntoFragments(text)).toHaveLength(200);
  });

  it("全是短片段时返回空数组", () => {
    expect(splitIntoFragments("啊\n哦\n\n嗯")).toEqual([]);
  });
});

describe("scoreClusterMatch", () => {
  it("命中的 token 按其字数累加得分", () => {
    // 标签分词 -> ['工程效率','写作']；文本含 '工程效率'(4) 与 '写作'(2) => 6
    expect(scoreClusterMatch("聊聊工程效率与写作", "工程效率、写作")).toBe(6);
  });

  it("单字 token（长度 <2）被忽略", () => {
    // '写' 长度 1 被过滤，仅 '效率'(2) 参与，文本含 '效率' => 2
    expect(scoreClusterMatch("关于效率", "写/效率")).toBe(2);
  });

  it("无命中得 0", () => {
    expect(scoreClusterMatch("完全无关的文本", "工程、写作")).toBe(0);
  });
});

describe("bestClusterFor", () => {
  const clusters = [
    { id: "c1", label: "工程效率" },
    { id: "c2", label: "写作方法" },
  ];

  it("选得分最高的簇", () => {
    expect(bestClusterFor("提升工程效率", clusters)?.id).toBe("c1");
  });

  it("没有正向匹配时返回 null", () => {
    expect(bestClusterFor("旅行摄影", clusters)).toBeNull();
  });
});

describe("dedupeSetsFromGaps", () => {
  it("titles 收全部，coveredClusterIds 排除 published", () => {
    const gaps: Gap[] = [
      { id: "g1", title: "A", confidence: 0.6, clusterIds: ["c1"], supportingFragmentIds: [], status: "todo" },
      { id: "g2", title: "B", confidence: 0.6, clusterIds: ["c2"], supportingFragmentIds: [], status: "published" },
    ];
    const { titles, coveredClusterIds } = dedupeSetsFromGaps(gaps);
    expect(titles).toEqual(new Set(["A", "B"]));
    // c2 属于 published 的 gap，不算已覆盖
    expect(coveredClusterIds).toEqual(new Set(["c1"]));
  });
});

describe("discoverGaps", () => {
  const now = Date.now();
  const fresh = new Date(now).toISOString();
  const cluster = (id: string, label: string): Cluster => ({ id, label, fragmentIds: [] });
  const frag = (id: string, clusterId: string): Fragment =>
    ({ id, clusterId, source: "raw", content: "x", createdAt: fresh });

  it("跳过碎片数不足 2 的簇", () => {
    const clusters = [cluster("c1", "工程")];
    const fragments = [frag("f1", "c1")]; // 只有 1 条
    expect(discoverGaps(clusters, fragments, [])).toEqual([]);
  });

  it("为合格簇产出候选，confidence 手算 = 0.5+2*0.06+2*0.04 = 0.70", () => {
    const clusters = [cluster("c1", "工程")];
    const fragments = [frag("f1", "c1"), frag("f2", "c1")];
    const [gap] = discoverGaps(clusters, fragments, []);
    expect(gap.clusterIds).toEqual(["c1"]);
    expect(gap.supportingFragmentIds).toEqual(["f1", "f2"]);
    expect(gap.confidence).toBe(0.7);
    // score = density(2) + fresh(2)*1.5 = 5
    expect(gap.score).toBe(5);
  });

  it("跳过已被非 published gap 覆盖的簇", () => {
    const clusters = [cluster("c1", "工程")];
    const fragments = [frag("f1", "c1"), frag("f2", "c1")];
    const existing: Gap[] = [
      { id: "g1", title: "已有", confidence: 0.6, clusterIds: ["c1"], supportingFragmentIds: [], status: "todo" },
    ];
    expect(discoverGaps(clusters, fragments, existing)).toEqual([]);
  });

  it("按 score 降序并受 limit 截断", () => {
    const clusters = [cluster("c1", "少"), cluster("c2", "多")];
    const fragments = [
      frag("a1", "c1"), frag("a2", "c1"), // c1: density 2
      frag("b1", "c2"), frag("b2", "c2"), frag("b3", "c2"), // c2: density 3
    ];
    const out = discoverGaps(clusters, fragments, [], 1);
    expect(out).toHaveLength(1);
    expect(out[0].clusterIds).toEqual(["c2"]); // density 更高，score 更高
  });

  // ── 新规则：盘活率过滤（reflow-saturation）──
  const rfrag = (id: string, clusterId: string, reflowed: boolean): Fragment =>
    ({ id, clusterId, source: "raw", content: "x", createdAt: fresh, reflowed });

  it("跳过已盘活比例 ≥ 0.8 的簇（4/5 = 0.8，含边界）", () => {
    const clusters = [cluster("c1", "工程")];
    const fragments = [
      rfrag("f1", "c1", true),
      rfrag("f2", "c1", true),
      rfrag("f3", "c1", true),
      rfrag("f4", "c1", true),
      rfrag("f5", "c1", false), // 4/5 = 0.8 恰好饱和
    ];
    expect(discoverGaps(clusters, fragments, [])).toEqual([]);
  });

  it("盘活比例低于 0.8 的簇仍会被提出（2/5 = 0.4）", () => {
    const clusters = [cluster("c1", "工程")];
    const fragments = [
      rfrag("f1", "c1", true),
      rfrag("f2", "c1", true),
      rfrag("f3", "c1", false),
      rfrag("f4", "c1", false),
      rfrag("f5", "c1", false),
    ];
    const out = discoverGaps(clusters, fragments, []);
    expect(out).toHaveLength(1);
    expect(out[0].clusterIds).toEqual(["c1"]);
  });
});
