// 选题门槛（借鉴 daily-news-digest 的编辑关卡）：
// 在动笔前用可解释的维度评估一个选题「是否够扎实、值得现在写」，
// 并显式标注确定性——✅ 够扎实 / ⚠️ 证据偏薄。只提示、不替你决定，契合织知定位。
//
// 维度：
//  · 证据充分度 evidence —— 支撑碎片数量
//  · 新鲜度 fresh —— 近 7 天新增的支撑碎片数
//  · 可行动性 —— 证据是否足够立刻动笔（evidence 达阈值）
// 纯函数 + 可注入 now，便于测试。

import type { Fragment, Gap } from "./types";

export type ReadinessLevel = "ready" | "thin";

export interface GapReadiness {
  /** ✅ ready = 够扎实；⚠️ thin = 证据偏薄，建议先补素材 */
  level: ReadinessLevel;
  /** 支撑碎片数（证据充分度） */
  evidence: number;
  /** 近 7 天新增支撑碎片数 */
  fresh: number;
  /** i18n 理由 key，由组件翻译 */
  reasonKey:
    | "readyFresh" // 证据足 + 有新素材
    | "readySolid" // 证据足
    | "thinFewEvidence" // 证据不足
    | "thinStale"; // 有证据但都不新，动力弱
}

const MIN_EVIDENCE = 3; // 可行动阈值：至少 3 条支撑碎片才算够动笔
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** 评估一个选题的「动笔门槛」。 */
export function assessGapReadiness(
  gap: Gap,
  fragments: Fragment[],
  now: Date = new Date(),
): GapReadiness {
  const supportIds = new Set(gap.supportingFragmentIds);
  const evidence = gap.supportingFragmentIds.length;
  const weekAgo = now.getTime() - WEEK_MS;
  const fresh = fragments.filter(
    (f) => supportIds.has(f.id) && new Date(f.createdAt).getTime() >= weekAgo,
  ).length;

  if (evidence < MIN_EVIDENCE) {
    return { level: "thin", evidence, fresh, reasonKey: "thinFewEvidence" };
  }
  if (fresh >= 1) {
    return { level: "ready", evidence, fresh, reasonKey: "readyFresh" };
  }
  // 证据够但都不新：可写，但动力偏弱，仍算 ready，只是理由不同
  return { level: "ready", evidence, fresh, reasonKey: "readySolid" };
}
