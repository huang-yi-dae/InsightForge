import type { Cluster, Fragment, Gap } from "./types";

// 从存量内容（碎片 + 簇）里发现「可写的点」。
// 纯本地启发式：无需任何 AI Key 即可运行；有 AI 时可在此结果上再增强。
//
// 打分依据：
//  - 密度：该簇里可用碎片越多越值得写
//  - 新鲜度：最近新增的碎片加权
//  - 去重：已存在（标题重合/同簇已有 gap）的不再重复提出

// ── 可调常量（原先散落在 discovery / store / route 里的魔法数字，集中于此）──
export const DISCOVERY = {
  /** 一个簇至少要有几条碎片才值得提为可写点 */
  MIN_FRAGMENTS_PER_CLUSTER: 2,
  /** 每个可写点最多挂多少条支撑碎片 */
  MAX_SUPPORTING_FRAGMENTS: 6,
  /** 一次发现默认返回多少个（初始阶段应少量） */
  DEFAULT_LIMIT: 3,
  /** AI 发现单次上限 */
  MAX_LIMIT: 6,
  /** AI 发现请求超时（ms）。实测单次可达约 20s，留足余量避免常态回退（P0） */
  AI_TIMEOUT_MS: 40000,
  /** 新鲜度窗口：最近多少毫秒内新增算「新鲜」 */
  FRESH_WINDOW_MS: 7 * 24 * 3600 * 1000,
  /** 置信度基线与权重 */
  CONFIDENCE_BASE: 0.5,
  CONFIDENCE_DENSITY_WEIGHT: 0.06,
  CONFIDENCE_FRESH_WEIGHT: 0.04,
  CONFIDENCE_MAX: 0.9,
  /** 排序分：新鲜度相对密度的加权 */
  SCORE_FRESH_WEIGHT: 1.5,
  /** 导入切片：单条碎片最短字数、单次最多切多少条 */
  MIN_FRAGMENT_CHARS: 6,
  MAX_IMPORT_FRAGMENTS: 200,
  /** 盘活饱和阈值：簇内 reflowed 比例 ≥ 此值则不再提为可写点 */
  REFLOW_SATURATION: 0.8,
} as const;

// AI 发现返回的选题（/api/discover 与 store 共用，避免重复声明）
export interface AiIdea {
  title: string;
  clusterId: string;
  confidence: number; // 0-1
  reason: string;
}

export interface DiscoveredGap {
  title: string;
  clusterIds: string[];
  supportingFragmentIds: string[];
  confidence: number; // 0-1
  score: number; // 排序用
}

// ── 共享：归簇打分（captureFragment / importContent / discoverNewGapsAI 复用）──

/** 文本与某个簇标签的重合度：标签分词后，命中越多、词越长得分越高 */
export function scoreClusterMatch(text: string, label: string): number {
  const tokens = label.split(/[\s/·、,，]+/).filter((x) => x.length >= 2);
  return tokens.reduce((s, tk) => (text.includes(tk) ? s + tk.length : s), 0);
}

/** 为一段文本挑最匹配的簇；无正向匹配返回 null（由调用方决定回退策略） */
export function bestClusterFor<T extends { id: string; label: string }>(
  text: string,
  clusters: T[],
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const c of clusters) {
    const score = scoreClusterMatch(text, c.label);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// ── 共享：针对已有 gaps 的去重集合 ──
export function dedupeSetsFromGaps(existingGaps: Gap[]): {
  titles: Set<string>;
  coveredClusterIds: Set<string>;
} {
  return {
    titles: new Set(existingGaps.map((g) => g.title)),
    coveredClusterIds: new Set(
      existingGaps.filter((g) => g.status !== "published").flatMap((g) => g.clusterIds),
    ),
  };
}

function freshness(fragments: Fragment[], ids: Set<string>): number {
  const now = Date.now();
  return fragments.filter(
    (f) => ids.has(f.id) && now - new Date(f.createdAt).getTime() <= DISCOVERY.FRESH_WINDOW_MS,
  ).length;
}

/**
 * 基于当前碎片/簇，发现候选可写点。
 * @param limit 最多返回多少个（初始阶段应少量）
 * @param existingGaps 已有 gap，用于去重（同簇已有活跃 gap 则跳过）
 */
export function discoverGaps(
  clusters: Cluster[],
  fragments: Fragment[],
  existingGaps: Gap[],
  limit: number = DISCOVERY.DEFAULT_LIMIT,
): DiscoveredGap[] {
  const { titles: existingTitles, coveredClusterIds } = dedupeSetsFromGaps(existingGaps);

  const candidates: DiscoveredGap[] = [];

  for (const cluster of clusters) {
    const clusterFragments = fragments.filter((f) => f.clusterId === cluster.id);
    if (clusterFragments.length < DISCOVERY.MIN_FRAGMENTS_PER_CLUSTER) continue;
    if (coveredClusterIds.has(cluster.id)) continue;

    // 盘活饱和过滤：簇内已被成文引用的碎片占比过高，说明没什么新东西可挖，跳过
    const reflowedRatio =
      clusterFragments.filter((f) => f.reflowed).length / clusterFragments.length;
    if (reflowedRatio >= DISCOVERY.REFLOW_SATURATION) continue;

    const ids = clusterFragments.map((f) => f.id);
    const density = clusterFragments.length;
    const fresh = freshness(fragments, new Set(ids));

    const confidence = Math.min(
      DISCOVERY.CONFIDENCE_MAX,
      DISCOVERY.CONFIDENCE_BASE +
        density * DISCOVERY.CONFIDENCE_DENSITY_WEIGHT +
        fresh * DISCOVERY.CONFIDENCE_FRESH_WEIGHT,
    );
    const score = density + fresh * DISCOVERY.SCORE_FRESH_WEIGHT;

    const title = `${cluster.label}：从碎片里能写出什么`;
    if (existingTitles.has(title)) continue;

    candidates.push({
      title,
      clusterIds: [cluster.id],
      supportingFragmentIds: ids.slice(0, DISCOVERY.MAX_SUPPORTING_FRAGMENTS),
      confidence: Number(confidence.toFixed(2)),
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, Math.max(1, limit));
}

// 把发现结果落成 Gap（供 store 追加）
export function toGap(d: DiscoveredGap): Gap {
  return {
    id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: d.title,
    confidence: d.confidence,
    clusterIds: d.clusterIds,
    supportingFragmentIds: d.supportingFragmentIds,
    status: "todo",
  };
}

// 把一段长文本切成碎片（按空行/换行分段，过滤过短片段）。
export function splitIntoFragments(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .flatMap((block) => block.split(/\n/))
    .map((s) => s.trim())
    .filter((s) => s.length >= DISCOVERY.MIN_FRAGMENT_CHARS)
    .slice(0, DISCOVERY.MAX_IMPORT_FRAGMENTS);
}

/**
 * 按主题推荐「库内相关碎片」（文章详情页用，纯库内、无外网）。
 * 逻辑：以已引用碎片所在的簇为主题范围，从这些簇里挑出尚未被引用的其它碎片，
 * 按「新鲜度（新的在前）」排序返回。全在本地知识库内完成。
 * @param citedIds 已引用的碎片 id（会被排除）
 * @param limit 最多推荐多少条
 */
export function recommendFragmentsForGap(
  fragments: Fragment[],
  citedIds: string[],
  limit = 6,
): Fragment[] {
  const cited = new Set(citedIds);
  // 已引用碎片覆盖到的簇 = 主题范围
  const topicClusters = new Set(
    fragments.filter((f) => cited.has(f.id)).map((f) => f.clusterId),
  );
  if (topicClusters.size === 0) return [];
  return fragments
    .filter((f) => !cited.has(f.id) && topicClusters.has(f.clusterId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
