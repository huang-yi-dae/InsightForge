// 全文搜索：在碎片(fragments)与成文(writings)里做关键词检索并按相关度排序。
// 借鉴 RAG「混合检索」的轻量离线实现——无需向量库：
//   · 把 query 拆成关键词（空白/标点分隔），大小写不敏感
//   · 每条内容按「命中的关键词种类数 + 总命中次数 + 标题命中加权」打分
//   · 按分数降序排（成文优先作为 tie-break），而非仅按有无命中
// 纯函数、无副作用，便于测试与 SSR 一致。单词查询与旧的子串行为兼容。

import type { Fragment, Writing } from "./types";

export type SearchHitKind = "fragment" | "writing";

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  title: string;
  /** 命中所在的一段文本（用于展示摘要） */
  snippet: string;
  /** snippet 中首个命中关键词的起止（相对 snippet），供高亮 */
  matchStart: number;
  matchEnd: number;
  /** 相关度分数（越大越相关），供排序/调试 */
  score: number;
}

const SNIPPET_RADIUS = 40;
const TITLE_WEIGHT = 3; // 标题命中比正文更重要

// 把查询串拆成去重后的关键词（小写）。中文按标点/空白切段，英文按词切。
export function tokenizeQuery(query: string): string[] {
  const parts = query
    .toLowerCase()
    .split(/[\s,，。、;；:：!！?？"“”'']+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

// 统计某关键词在文本里的出现次数（大小写不敏感），并返回首次命中位置。
function countOccurrences(lowerText: string, kw: string): { count: number; first: number } {
  if (!kw) return { count: 0, first: -1 };
  let count = 0;
  let first = -1;
  let idx = lowerText.indexOf(kw);
  while (idx >= 0) {
    if (first < 0) first = idx;
    count += 1;
    idx = lowerText.indexOf(kw, idx + kw.length);
  }
  return { count, first };
}

function buildSnippet(
  text: string,
  hitIndex: number,
  hitLen: number,
): { snippet: string; matchStart: number; matchEnd: number } {
  const from = Math.max(0, hitIndex - SNIPPET_RADIUS);
  const to = Math.min(text.length, hitIndex + hitLen + SNIPPET_RADIUS);
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  const snippet = prefix + text.slice(from, to) + suffix;
  const matchStart = prefix.length + (hitIndex - from);
  const matchEnd = matchStart + hitLen;
  return { snippet, matchStart, matchEnd };
}

export interface SearchInput {
  fragments: Fragment[];
  writings: Writing[];
}

interface Scored {
  hit: SearchHit;
  matchedKinds: number; // 命中的关键词种类数（相关度主因子）
}

// 对一段文本（可含标题）计算相关度，命中则返回一个 SearchHit。
function scoreText(
  keywords: string[],
  title: string,
  body: string,
): { score: number; matchedKinds: number; firstKw: string; firstIndex: number } | null {
  const lowerTitle = title.toLowerCase();
  const lowerBody = body.toLowerCase();
  let score = 0;
  let matchedKinds = 0;
  let firstKw = "";
  let firstIndex = Infinity;

  for (const kw of keywords) {
    const inTitle = countOccurrences(lowerTitle, kw);
    const inBody = countOccurrences(lowerBody, kw);
    const total = inTitle.count + inBody.count;
    if (total === 0) continue;
    matchedKinds += 1;
    score += inTitle.count * TITLE_WEIGHT + inBody.count;
    // 记录正文里最靠前的命中，用于摘要；正文没有则用标题
    const bodyFirst = inBody.first >= 0 ? inBody.first : -1;
    if (bodyFirst >= 0 && bodyFirst < firstIndex) {
      firstIndex = bodyFirst;
      firstKw = kw;
    } else if (bodyFirst < 0 && inTitle.first >= 0 && firstIndex === Infinity) {
      firstIndex = -1; // 标记为标题命中
      firstKw = kw;
    }
  }

  if (matchedKinds === 0) return null;
  // 命中关键词种类越多，相关度加成越大（覆盖度优先于词频）
  score += matchedKinds * 10;
  return { score, matchedKinds, firstKw, firstIndex };
}

/**
 * 执行搜索。query 去空白后为空返回空数组。
 * 结果按相关度分数降序；同分时成文优先、再按原顺序。
 */
export function searchKnowledge(query: string, input: SearchInput): SearchHit[] {
  const keywords = tokenizeQuery(query);
  if (keywords.length === 0) return [];

  const scored: Scored[] = [];

  input.writings.forEach((w, order) => {
    const r = scoreText(keywords, w.title, w.content);
    if (!r) return;
    const snip =
      r.firstIndex >= 0
        ? buildSnippet(w.content, r.firstIndex, r.firstKw.length)
        : buildSnippet(w.title, w.title.toLowerCase().indexOf(r.firstKw), r.firstKw.length);
    scored.push({
      matchedKinds: r.matchedKinds,
      hit: { kind: "writing", id: w.id, title: w.title, ...snip, score: r.score - order * 0.001 },
    });
  });

  input.fragments.forEach((f, order) => {
    const r = scoreText(keywords, "", f.content);
    if (!r) return;
    const idx = r.firstIndex >= 0 ? r.firstIndex : 0;
    const snip = buildSnippet(f.content, idx, r.firstKw.length);
    const firstLine = f.content.split("\n")[0].slice(0, 40);
    scored.push({
      matchedKinds: r.matchedKinds,
      // 碎片整体比成文次要：分数上略降，保证同相关度下成文优先
      hit: { kind: "fragment", id: f.id, title: firstLine, ...snip, score: r.score - 0.5 - order * 0.001 },
    });
  });

  scored.sort((a, b) => b.hit.score - a.hit.score);
  return scored.map((s) => s.hit);
}
