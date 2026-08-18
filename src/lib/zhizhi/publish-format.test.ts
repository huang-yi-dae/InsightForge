import { describe, it, expect } from "vitest";
import { parseBlocks, toWeixinHtml, toStandardMarkdown, toWordPressHtml } from "./publish-format";
import type { Writing } from "./types";

const w = (content: string, title = "标题"): Writing => ({
  id: "w1",
  draftId: "d1",
  gapId: "g1",
  title,
  content,
  userWords: 10,
  aiWords: 0,
  publishedAt: "2026-08-01T00:00:00.000Z",
  reflowed: true,
});

describe("parseBlocks", () => {
  it("解析标题/引用/段落/分隔线", () => {
    const b = parseBlocks("# 一级\n\n正文一\n\n> 引用\n\n---\n\n## 二级");
    expect(b.map((x) => x.kind)).toEqual(["heading", "para", "quote", "hr", "heading"]);
    expect(b[0]).toMatchObject({ level: 1, text: "一级" });
    expect(b[4]).toMatchObject({ level: 2, text: "二级" });
  });

  it("多行引用合并为一个块", () => {
    const b = parseBlocks("> 第一行\n> 第二行");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ kind: "quote", text: "第一行\n第二行" });
  });

  it("忽略空块", () => {
    expect(parseBlocks("\n\n   \n\n")).toEqual([]);
  });
});

describe("toWeixinHtml", () => {
  it("产出内联样式且转义", () => {
    const html = toWeixinHtml(w("正文 <b> 危险", "T&T"));
    expect(html).toContain("<h1 style=");
    expect(html).toContain("T&amp;T");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toMatch(/<p style="[^"]*line-height/);
  });

  it("引用块带品牌色左边框内联样式", () => {
    expect(toWeixinHtml(w("> 引"))).toContain("border-left:4px solid #0d9488");
  });
});

describe("toStandardMarkdown", () => {
  it("规范化标准 CommonMark", () => {
    const md = toStandardMarkdown(w("# H\n\n段落\n\n> 引\n\n---"));
    expect(md).toContain("# 标题");
    expect(md).toContain("# H");
    expect(md).toContain("> 引");
    expect(md).toContain("---");
    expect(md).not.toMatch(/\n{3,}/);
  });
});

describe("toWordPressHtml", () => {
  it("产出语义段落 HTML", () => {
    const html = toWordPressHtml(w("## 小标题\n\n正文\n\n> 引"));
    expect(html).toContain("<h2>小标题</h2>");
    expect(html).toContain("<p>正文</p>");
    expect(html).toContain("<blockquote><p>引</p></blockquote>");
  });

  it("转义 HTML 特殊字符", () => {
    expect(toWordPressHtml(w("a < b & c"))).toContain("a &lt; b &amp; c");
  });
});

describe("扩展块：代码/图片/列表", () => {
  it("代码块原样保留、不被误解析", () => {
    const b = parseBlocks("```js\n# 不是标题\nconst a = 1 < 2;\n```");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ kind: "code", lang: "js", text: "# 不是标题\nconst a = 1 < 2;" });
  });

  it("图片解析出 alt 与 url", () => {
    const b = parseBlocks("![封面图](https://x.com/a.png)");
    expect(b[0]).toMatchObject({ kind: "image", alt: "封面图", text: "https://x.com/a.png" });
  });

  it("无序/有序列表分别聚合", () => {
    const b = parseBlocks("- 甲\n- 乙\n\n1. 一\n2. 二");
    expect(b[0]).toMatchObject({ kind: "list", ordered: false, items: ["甲", "乙"] });
    expect(b[1]).toMatchObject({ kind: "list", ordered: true, items: ["一", "二"] });
  });

  it("公众号渲染代码块为深色 pre；列表用 • + <p> 不用 ul/li", () => {
    const html = toWeixinHtml(w("```\ncode\n```\n\n- 项"));
    expect(html).toContain("<pre style=");
    expect(html).toContain("<code style=");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("<li");
    expect(html).toContain("•");
    expect(html).toContain("项</p>");
  });

  it("标准 Markdown 回吐围栏代码块与列表", () => {
    const md = toStandardMarkdown(w("```py\nx=1\n```\n\n1. 甲"));
    expect(md).toContain("```py\nx=1\n```");
    expect(md).toContain("1. 甲");
  });

  it("WordPress 渲染 pre/figure/列表", () => {
    const html = toWordPressHtml(w("```\nc\n```\n\n![a](u)\n\n- x"));
    expect(html).toContain("<pre><code>c</code></pre>");
    expect(html).toContain('<img src="u" alt="a" />');
    expect(html).toContain("<ul>\n<li>x</li>\n</ul>");
  });
});
