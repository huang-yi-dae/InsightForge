import { describe, it, expect } from "vitest";
import { searchKnowledge } from "./search";
import type { Fragment, Writing } from "./types";

const frag = (id: string, content: string): Fragment => ({
  id,
  clusterId: "c1",
  source: "raw",
  content,
  createdAt: "2026-08-01T00:00:00.000Z",
});

const writing = (id: string, title: string, content: string): Writing => ({
  id,
  draftId: `d-${id}`,
  gapId: `g-${id}`,
  title,
  content,
  userWords: 10,
  aiWords: 0,
  publishedAt: "2026-08-01T00:00:00.000Z",
  reflowed: true,
});

const INPUT = {
  fragments: [
    frag("f1", "收集不等于成长，用产出倒逼输入。"),
    frag("f2", "Deep work requires sustained focus."),
  ],
  writings: [
    writing("w1", "反代写宣言", "AI 只给骨架，血肉由你补。"),
  ],
};

describe("searchKnowledge", () => {
  it("空查询返回空", () => {
    expect(searchKnowledge("", INPUT)).toEqual([]);
    expect(searchKnowledge("   ", INPUT)).toEqual([]);
  });

  it("命中碎片内容", () => {
    const hits = searchKnowledge("产出", INPUT);
    expect(hits.some((h) => h.kind === "fragment" && h.id === "f1")).toBe(true);
  });

  it("命中成文标题", () => {
    const hits = searchKnowledge("反代写", INPUT);
    expect(hits.some((h) => h.kind === "writing" && h.id === "w1")).toBe(true);
  });

  it("命中成文正文", () => {
    const hits = searchKnowledge("骨架", INPUT);
    expect(hits.some((h) => h.kind === "writing" && h.id === "w1")).toBe(true);
  });

  it("英文大小写不敏感", () => {
    expect(searchKnowledge("FOCUS", INPUT).some((h) => h.id === "f2")).toBe(true);
    expect(searchKnowledge("deep", INPUT).some((h) => h.id === "f2")).toBe(true);
  });

  it("成文排在碎片前", () => {
    // 让查询同时命中成文与碎片
    const input = {
      writings: [writing("w1", "焦点", "关于焦点的一篇")],
      fragments: [frag("f1", "焦点是稀缺资源")],
    };
    const hits = searchKnowledge("焦点", input);
    expect(hits[0].kind).toBe("writing");
  });

  it("snippet 的命中坐标正确", () => {
    const hits = searchKnowledge("产出", INPUT);
    const h = hits.find((x) => x.id === "f1")!;
    expect(h.snippet.slice(h.matchStart, h.matchEnd)).toBe("产出");
  });

  it("无命中返回空", () => {
    expect(searchKnowledge("xyznotfound", INPUT)).toEqual([]);
  });

  it("多关键词：命中更多关键词的排在前", () => {
    const input = {
      writings: [
        writing("wBoth", "焦虑与写作", "如何在焦虑中坚持写作"),
        writing("wOne", "写作日常", "只谈写作，不谈别的"),
      ],
      fragments: [],
    };
    // 用空格分词，"焦虑 写作" 应同时匹配两词
    const hits = searchKnowledge("焦虑 写作", input);
    expect(hits[0].id).toBe("wBoth"); // 命中 2 个关键词 > 命中 1 个
    expect(hits.map((h) => h.id)).toContain("wOne");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("词频更高的相关度更高", () => {
    const input = {
      writings: [
        writing("wHi", "专注", "专注 专注 再专注"),
        writing("wLo", "杂谈", "偶尔提一句专注"),
      ],
      fragments: [],
    };
    const hits = searchKnowledge("专注", input);
    expect(hits[0].id).toBe("wHi");
  });

  it("中文标点也能分词", () => {
    const hits = searchKnowledge("焦点，稀缺", {
      writings: [],
      fragments: [frag("f1", "焦点是稀缺资源")],
    });
    expect(hits[0].id).toBe("f1");
  });
});
