// 相关成文：让知识成网。两篇成文的相关度 = 共享概念簇数×2 + 共享引用碎片数。
// 依赖 gap 提供 clusterIds / supportingFragmentIds。纯函数、可测。

import type { Gap, Writing } from "./types";

export interface RelatedWriting {
  writing: Writing;
  /** 相关度得分，越高越相关 */
  score: number;
  /** 命中的共享簇数 / 共享碎片数（供 UI 说明「为什么相关」） */
  sharedClusters: number;
  sharedFragments: number;
}

function gapFor(gaps: Gap[], gapId: string): Gap | undefined {
  return gaps.find((g) => g.id === gapId);
}

/**
 * 给定目标成文，在其余成文里找相关的，按得分降序返回前 limit 篇。
 * 无 gap 信息或无任何交集的不返回。
 */
export function relatedWritings(
  target: Writing,
  allWritings: Writing[],
  gaps: Gap[],
  limit = 4,
): RelatedWriting[] {
  const targetGap = gapFor(gaps, target.gapId);
  if (!targetGap) return [];
  const targetClusters = new Set(targetGap.clusterIds);
  const targetFrags = new Set(targetGap.supportingFragmentIds);

  const scored: RelatedWriting[] = [];
  for (const w of allWritings) {
    if (w.id === target.id) continue;
    const g = gapFor(gaps, w.gapId);
    if (!g) continue;
    let sharedClusters = 0;
    for (const cid of g.clusterIds) if (targetClusters.has(cid)) sharedClusters += 1;
    let sharedFragments = 0;
    for (const fid of g.supportingFragmentIds) if (targetFrags.has(fid)) sharedFragments += 1;
    const score = sharedClusters * 2 + sharedFragments;
    if (score > 0) {
      scored.push({ writing: w, score, sharedClusters, sharedFragments });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, limit));
}
