// 身份档案的「记忆机制」——类 Claude-mem / Hermes：
// 不靠创作者手填，而是从 TA 已发布的成文里自动沉淀「观察」，
// 再提议对身份档案（观点/受众/语气/深耕话题）的增量更新，交由创作者一键采纳或撤销。
//
// 设计原则：
// - 纯函数、离线可测，不依赖 LLM（AI 味的「记忆」用可解释的启发式实现）。
// - 只提议、不静默改写；采纳是显式动作，符合织知「反代写、你说了算」。
// - 增量、去重、可撤销。

import type { Identity, Writing } from "./types";

export interface IdentityObservation {
  /** 从标题里抽出的高频话题词（按出现次数降序） */
  topTopics: { term: string; count: number }[];
  /** 平均人工字数占比 0..1（高 → 以我为主的独立表达） */
  avgHumanRatio: number;
  /** 参与统计的成文数 */
  sampleSize: number;
}

// 停用词：常见虚词/结构词，避免污染话题抽取
const STOP = new Set([
  "的", "了", "和", "与", "是", "在", "我", "你", "他", "她", "它", "们", "这", "那",
  "一个", "如何", "为什么", "什么", "怎么", "关于", "以及", "还是", "以及", "the", "a",
  "an", "of", "to", "and", "or", "for", "on", "in", "is", "how", "why", "what", "about",
]);

/** 从标题串里切出候选话题词（中文按 2-4 字窗口 + 英文按单词）。 */
function extractTerms(title: string): string[] {
  const terms: string[] = [];
  // 英文/数字词
  for (const m of title.toLowerCase().matchAll(/[a-z][a-z0-9+-]{2,}/g)) {
    if (!STOP.has(m[0])) terms.push(m[0]);
  }
  // 中文按标点切段后取 2-4 字片段
  const segments = title.replace(/[a-z0-9+-]+/gi, " ").split(/[\s，。、！？：；·—…()（）"“”'']+/);
  for (const seg of segments) {
    const s = seg.trim();
    if (s.length >= 2 && s.length <= 8 && /[\u4e00-\u9fa5]/.test(s) && !STOP.has(s)) {
      terms.push(s);
    }
  }
  return terms;
}

/** 从已发布成文里沉淀观察信号。 */
export function observeWritings(writings: Writing[]): IdentityObservation {
  const counts = new Map<string, number>();
  let humanSum = 0;
  let ratioSamples = 0;
  for (const w of writings) {
    for (const term of extractTerms(w.title)) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    const total = (w.userWords ?? 0) + (w.aiWords ?? 0);
    if (total > 0) {
      humanSum += (w.userWords ?? 0) / total;
      ratioSamples += 1;
    }
  }
  const topTopics = [...counts.entries()]
    .filter(([, c]) => c >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([term, count]) => ({ term, count }));
  return {
    topTopics,
    avgHumanRatio: ratioSamples > 0 ? humanSum / ratioSamples : 0,
    sampleSize: writings.length,
  };
}

export type IdentityField = keyof Identity;

export interface IdentityProposal {
  field: IdentityField;
  /** 采纳后该字段的新值（已与现值合并/去重） */
  nextValue: string;
  /** 展示给创作者的「新增内容」摘要 */
  added: string;
  /** i18n 理由 key 与参数，由 UI 翻译 */
  reasonKey: "topicsFromTitles" | "voiceHighHuman";
  reasonParams?: Record<string, string | number>;
}

function splitTopics(s: string): string[] {
  return s
    .split(/[,，、;；]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 对比现有 Identity 与观察，产出增量更新提议。
 * - topics：把高频但尚未记录的话题词建议追加（去重）。
 * - voice：当人工占比持续很高且 voice 尚未提及「独立/以我为主」，建议补一句风格信号。
 */
export function proposeIdentityUpdates(
  identity: Identity,
  obs: IdentityObservation,
  opts: { minSample?: number } = {},
): IdentityProposal[] {
  const minSample = opts.minSample ?? 3;
  const proposals: IdentityProposal[] = [];
  if (obs.sampleSize < minSample) return proposals;

  // —— topics 提议 ——
  const existing = new Set(splitTopics(identity.topics).map((x) => x.toLowerCase()));
  const newTerms = obs.topTopics
    .filter((t) => t.count >= 2 && !existing.has(t.term.toLowerCase()))
    .map((t) => t.term)
    .slice(0, 3);
  if (newTerms.length > 0) {
    const merged = [...splitTopics(identity.topics), ...newTerms];
    proposals.push({
      field: "topics",
      nextValue: merged.join("，"),
      added: newTerms.join("，"),
      reasonKey: "topicsFromTitles",
      reasonParams: { terms: newTerms.join("、"), count: obs.sampleSize },
    });
  }

  // —— voice 提议 ——
  const VOICE_TAG = "以我为主、独立表达";
  if (obs.avgHumanRatio >= 0.7 && !identity.voice.includes(VOICE_TAG)) {
    const nextValue = identity.voice.trim()
      ? `${identity.voice.trim()}；${VOICE_TAG}`
      : VOICE_TAG;
    proposals.push({
      field: "voice",
      nextValue,
      added: VOICE_TAG,
      reasonKey: "voiceHighHuman",
      reasonParams: { pct: Math.round(obs.avgHumanRatio * 100) },
    });
  }

  return proposals;
}

/** 采纳单条提议：返回该字段的新值（纯函数，供 store.setIdentity 使用）。 */
export function applyProposal(proposal: IdentityProposal): Partial<Identity> {
  return { [proposal.field]: proposal.nextValue } as Partial<Identity>;
}
