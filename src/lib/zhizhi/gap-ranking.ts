// AI 选题增强：消费（可被 AI 自动更新的）身份档案，对候选选题重排并给出「为什么贴合你」。
// 与 discover.ts 的 LLM 侧注入互补——这一层是可解释、可测的前端加权：
// 命中你深耕话题 / 观点关键词的选题会被抬升，并标出命中的词，让排序对你透明。
// 纯函数，离线可测。

import type { Gap, Identity } from "./types";

export interface RankedGap {
  gap: Gap;
  /** 排序分：confidence 基准 + 身份契合加权 */
  score: number;
  /** 命中的身份关键词（深耕话题 / 观点里的词），用于「贴合你」理由 */
  matched: string[];
}

// 从身份档案里抽出用于匹配的关键词：深耕话题 + 观点/立场里的实词。
function identityKeywords(identity: Identity): string[] {
  const raw = [identity.topics, identity.pointOfView].join("，");
  const set = new Set<string>();
  for (const part of raw.split(/[,，、;；\s]+/)) {
    const s = part.trim();
    if (s.length >= 2) set.add(s);
  }
  return [...set];
}

const TOPIC_BONUS = 0.15; // 每命中一个身份关键词的加权，封顶避免碾压 confidence

/**
 * 用身份档案对 gaps 重排。命中越多身份关键词、confidence 越高越靠前。
 * 不改动 gap 本身，只返回排序视图。
 */
export function rankGapsByIdentity(gaps: Gap[], identity: Identity): RankedGap[] {
  const keywords = identityKeywords(identity);
  const ranked: RankedGap[] = gaps.map((gap) => {
    const title = gap.title.toLowerCase();
    const matched = keywords.filter((k) => title.includes(k.toLowerCase()));
    const score = gap.confidence + Math.min(3, matched.length) * TOPIC_BONUS;
    return { gap, score, matched };
  });
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.gap.confidence - a.gap.confidence ||
      a.gap.title.localeCompare(b.gap.title),
  );
  return ranked;
}
