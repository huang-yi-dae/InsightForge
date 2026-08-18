// 发布集成：把成文正文一键转成各平台可直接粘贴的格式。
// 解决写作工具共同痛点——「写完之后的多目标格式化」。纯函数、可测。
//
// 支持块：# 标题、> 引用、``` 代码块、![]() 图片、- / 1. 列表、--- 分隔线、普通段落。
// 渲染目标：
// - 公众号：内联样式 HTML（公众号编辑器只认内联 style，粘贴即带排版）
// - 标准 Markdown：规范化 CommonMark（Ghost / Medium 兼容）
// - WordPress：段落化语义 HTML（<p>/<h2>/<pre>/<ul>，经典编辑器可用）

import type { Writing } from "./types";

export type BlockKind = "heading" | "quote" | "para" | "hr" | "code" | "image" | "list";

export interface Block {
  kind: BlockKind;
  level?: number; // heading 级别 1-6
  text: string;
  lang?: string; // code 语言
  alt?: string; // image 替代文本
  ordered?: boolean; // list 是否有序
  items?: string[]; // list 项
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const FENCE_RE = /^```\s*([\w+-]*)\s*$/;
const ULI_RE = /^\s*[-*+]\s+(.+)$/;
const OLI_RE = /^\s*\d+[.)]\s+(.+)$/;

// 把正文按行解析成块。
export function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let paraBuf: string[] = [];
  let quoteBuf: string[] = [];
  let listBuf: string[] = [];
  let listOrdered = false;
  let inList = false;
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang = "";

  const flushPara = () => {
    if (paraBuf.length) {
      blocks.push({ kind: "para", text: paraBuf.join("\n").trim() });
      paraBuf = [];
    }
  };
  const flushQuote = () => {
    if (quoteBuf.length) {
      blocks.push({ kind: "quote", text: quoteBuf.join("\n").trim() });
      quoteBuf = [];
    }
  };
  const flushList = () => {
    if (inList && listBuf.length) {
      blocks.push({ kind: "list", text: "", ordered: listOrdered, items: [...listBuf] });
    }
    listBuf = [];
    inList = false;
  };
  const flushInline = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (const raw of lines) {
    const fence = FENCE_RE.exec(raw.trim());
    if (inCode) {
      if (raw.trim() === "```") {
        blocks.push({ kind: "code", text: codeBuf.join("\n"), lang: codeLang });
        inCode = false;
        codeBuf = [];
        codeLang = "";
      } else {
        codeBuf.push(raw);
      }
      continue;
    }
    if (fence) {
      flushInline();
      inCode = true;
      codeLang = fence[1] || "";
      continue;
    }

    const line = raw.replace(/\s+$/, "");
    const img = IMAGE_RE.exec(line.trim());
    const uli = ULI_RE.exec(line);
    const oli = OLI_RE.exec(line);
    const isQuote = /^\s*>\s?/.test(line);
    const heading = HEADING_RE.exec(line.trim());

    if (uli || oli) {
      flushPara();
      flushQuote();
      const ordered = !!oli;
      if (inList && ordered !== listOrdered) flushList();
      inList = true;
      listOrdered = ordered;
      listBuf.push((uli ? uli[1] : oli![1]).trim());
      continue;
    }
    flushList();

    if (isQuote) {
      flushPara();
      quoteBuf.push(line.replace(/^\s*>\s?/, ""));
      continue;
    }
    flushQuote();

    if (img) {
      flushPara();
      blocks.push({ kind: "image", text: img[2].trim(), alt: img[1].trim() });
    } else if (heading) {
      flushPara();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      blocks.push({ kind: "hr", text: "" });
    } else if (line.trim() === "") {
      flushPara();
    } else {
      paraBuf.push(line);
    }
  }
  if (inCode) blocks.push({ kind: "code", text: codeBuf.join("\n"), lang: codeLang });
  flushInline();

  return blocks.filter(
    (b) =>
      b.kind === "hr" ||
      b.kind === "code" ||
      b.kind === "image" ||
      (b.kind === "list" ? (b.items?.length ?? 0) > 0 : b.text.length > 0),
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 公众号品牌主色（织知青绿），用于标题左边框、引用与列表符号。
const WX_ACCENT = "#0d9488";

// —— 公众号：内联样式 HTML ——
// 遵循公众号编辑器实测规范：
//  · 编辑器过滤 <style>/class，只保留内联 style（本函数全内联）
//  · 列表禁用 <ul>/<li>（粘贴后会出现多余黑点），改用「•」+ <p>
//  · 正文 15px / 行距 1.6 / 正文色 #333；二级标题带品牌色左边框
export function toWeixinHtml(w: Writing): string {
  const blocks = parseBlocks(w.content);
  const parts: string[] = [];
  parts.push(
    `<h1 style="font-size:22px;font-weight:bold;line-height:1.4;margin:0 0 16px;color:#1a1a1a;">${esc(w.title)}</h1>`,
  );
  for (const b of blocks) {
    if (b.kind === "heading") {
      const lvl = Math.min(b.level ?? 2, 3);
      const size = b.level === 1 ? 19 : b.level === 2 ? 18 : 16;
      parts.push(
        `<h${lvl} style="font-size:${size}px;font-weight:bold;line-height:1.5;margin:28px 0 14px;padding-left:10px;border-left:4px solid ${WX_ACCENT};color:#1a1a1a;">${esc(b.text)}</h${lvl}>`,
      );
    } else if (b.kind === "quote") {
      parts.push(
        `<blockquote style="margin:16px 0;padding:12px 14px;border-left:4px solid ${WX_ACCENT};background:#f0f9f7;color:#555;font-size:15px;line-height:1.8;">${esc(b.text).replace(/\n/g, "<br/>")}</blockquote>`,
      );
    } else if (b.kind === "code") {
      parts.push(
        `<pre style="margin:16px 0;padding:14px 16px;background:#1a1a2e;border-radius:8px;overflow-x:auto;"><code style="font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.7;color:#a5f3fc;white-space:pre;">${esc(b.text)}</code></pre>`,
      );
    } else if (b.kind === "image") {
      parts.push(
        `<figure style="margin:18px 0;text-align:center;"><img src="${esc(b.text)}" alt="${esc(b.alt ?? "")}" style="max-width:100%;border-radius:4px;"/>${b.alt ? `<figcaption style="font-size:13px;color:#999;margin-top:6px;">${esc(b.alt)}</figcaption>` : ""}</figure>`,
      );
    } else if (b.kind === "list") {
      // 公众号规范：不用 <ul>/<li>，逐项渲染为「符号 + <p>」段落，避免多余黑点。
      (b.items ?? []).forEach((it, i) => {
        const marker = b.ordered ? `${i + 1}.` : "•";
        parts.push(
          `<p style="font-size:15px;line-height:1.6;margin:8px 0;color:#333;"><span style="color:${WX_ACCENT};margin-right:6px;">${marker}</span>${esc(it)}</p>`,
        );
      });
    } else if (b.kind === "hr") {
      parts.push(`<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;"/>`);
    } else {
      parts.push(
        `<p style="font-size:15px;line-height:1.6;margin:12px 0;color:#333;">${esc(b.text).replace(/\n/g, "<br/>")}</p>`,
      );
    }
  }
  return `<section style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;font-size:15px;line-height:1.6;color:#333;">${parts.join("")}</section>`;
}

// —— 标准 Markdown（Ghost / Medium 兼容）——
export function toStandardMarkdown(w: Writing): string {
  const blocks = parseBlocks(w.content);
  const out: string[] = [`# ${w.title}`, ""];
  for (const b of blocks) {
    if (b.kind === "heading") {
      out.push(`${"#".repeat(Math.min(b.level ?? 2, 6))} ${b.text}`, "");
    } else if (b.kind === "quote") {
      out.push(b.text.split("\n").map((l) => `> ${l}`).join("\n"), "");
    } else if (b.kind === "code") {
      out.push("```" + (b.lang ?? ""), b.text, "```", "");
    } else if (b.kind === "image") {
      out.push(`![${b.alt ?? ""}](${b.text})`, "");
    } else if (b.kind === "list") {
      out.push(
        (b.items ?? [])
          .map((it, i) => (b.ordered ? `${i + 1}. ${it}` : `- ${it}`))
          .join("\n"),
        "",
      );
    } else if (b.kind === "hr") {
      out.push("---", "");
    } else {
      out.push(b.text, "");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// —— WordPress：段落化语义 HTML（经典编辑器「文本」模式）——
export function toWordPressHtml(w: Writing): string {
  const blocks = parseBlocks(w.content);
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") {
      const lvl = Math.min(b.level ?? 2, 6);
      parts.push(`<h${lvl}>${esc(b.text)}</h${lvl}>`);
    } else if (b.kind === "quote") {
      parts.push(`<blockquote><p>${esc(b.text).replace(/\n/g, "<br />")}</p></blockquote>`);
    } else if (b.kind === "code") {
      parts.push(`<pre><code>${esc(b.text)}</code></pre>`);
    } else if (b.kind === "image") {
      parts.push(
        `<figure><img src="${esc(b.text)}" alt="${esc(b.alt ?? "")}" />${b.alt ? `<figcaption>${esc(b.alt)}</figcaption>` : ""}</figure>`,
      );
    } else if (b.kind === "list") {
      const tag = b.ordered ? "ol" : "ul";
      const lis = (b.items ?? []).map((it) => `<li>${esc(it)}</li>`).join("\n");
      parts.push(`<${tag}>\n${lis}\n</${tag}>`);
    } else if (b.kind === "hr") {
      parts.push(`<hr />`);
    } else {
      parts.push(`<p>${esc(b.text).replace(/\n/g, "<br />")}</p>`);
    }
  }
  return parts.join("\n\n");
}
