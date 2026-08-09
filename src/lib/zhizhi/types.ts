// 织知 InsightForge —— 领域类型定义
// 反代写写作引擎：碎片 → 聚类 → 空白 → 骨架 → 草稿 → 成文 → 回流

export type FragmentSource = "flomo" | "para" | "raw";

export interface Fragment {
  id: string;
  clusterId: string;
  source: FragmentSource;
  content: string;
  createdAt: string; // ISO
  reflowed?: boolean; // 是否被某篇成文引用/盘活
}

export interface Cluster {
  id: string;
  label: string;
  fragmentIds: string[];
}

export interface Gap {
  id: string;
  title: string;
  confidence: number; // 0-1
  clusterIds: string[]; // 相邻概念簇
  supportingFragmentIds: string[];
  status: "todo" | "drafting" | "published";
  draftId?: string;
}

// 骨架：AI 只出提纲/要点，绝不出成段文字
export interface SkeletonPoint {
  heading: string;
  bullets: string[];
}

export interface Skeleton {
  points: SkeletonPoint[];
  generatedAt: string;
}

export interface Draft {
  id: string;
  gapId: string;
  title: string;
  content: string; // 你写的正文
  skeleton?: Skeleton;
  userWords: number; // 人工字数
  aiWords: number; // AI 字数（请求展开插入的要点等）
  expandUses: number; // 「请求展开」已用次数
  citedFragmentIds: string[];
  updatedAt: string;
  status: "drafting" | "published";
}

export interface Writing {
  id: string;
  draftId: string;
  gapId: string;
  title: string;
  content: string;
  userWords: number;
  aiWords: number;
  publishedAt: string;
  reflowed: boolean;
}

// 反代写护栏阈值（可在设置页调整）
export interface Guardrails {
  aiRatioLimit: number; // AI 字数占比上限，超过告警。默认 0.3
  expandLimit: number; // 每篇「请求展开」次数上限。默认 3
  dailyInflowLimit: number; // 每日碎片流入上限，防「收集病」。默认 20
}

export const DEFAULT_GUARDRAILS: Guardrails = {
  aiRatioLimit: 0.3,
  expandLimit: 3,
  dailyInflowLimit: 20,
};

// 中文/混排字数：按非空白字符计
export function countWords(text: string): number {
  return (text.match(/[\S]/gu) || []).length;
}

export function aiRatio(userWords: number, aiWords: number): number {
  const total = userWords + aiWords;
  if (total === 0) return 0;
  return aiWords / total;
}
