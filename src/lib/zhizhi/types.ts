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
  // AI 发现时给出的一句选题理由（本地启发式发现的没有）
  aiReason?: string;
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

// 创作者身份档案：生成骨架时注入，让提纲更「像你」。
// 借鉴 Eden 的 Identity，但仅用于影响提纲/要点的取向，绝不代写成段文字。
export interface Identity {
  pointOfView: string; // 你的核心观点/立场
  audience: string; // 你写给谁看
  voice: string; // 语气/风格（如：克制、第一人称、多用比喻）
  topics: string; // 长期深耕的话题（逗号分隔亦可）
}

export const DEFAULT_IDENTITY: Identity = {
  pointOfView: "",
  audience: "",
  voice: "",
  topics: "",
};

export function identityIsEmpty(id: Identity | undefined | null): boolean {
  if (!id) return true;
  return !(id.pointOfView || id.audience || id.voice || id.topics).trim();
}

// 把身份档案压成一段简短上下文，供 AI 提示词或前端 fallback 使用。
export function identityToPromptContext(id: Identity | undefined | null): string {
  if (!id || identityIsEmpty(id)) return "";
  const lines: string[] = [];
  if (id.pointOfView.trim()) lines.push(`观点/立场：${id.pointOfView.trim()}`);
  if (id.audience.trim()) lines.push(`目标读者：${id.audience.trim()}`);
  if (id.voice.trim()) lines.push(`语气/风格：${id.voice.trim()}`);
  if (id.topics.trim()) lines.push(`深耕话题：${id.topics.trim()}`);
  return lines.join("\n");
}

// 中文/混排字数：按非空白字符计
export function countWords(text: string): number {
  return (text.match(/[\S]/gu) || []).length;
}

export function aiRatio(userWords: number, aiWords: number): number {
  const total = userWords + aiWords;
  if (total === 0) return 0;
  return aiWords / total;
}

// 选题理由：为一个 gap 生成「为什么先写这个」的结构化依据。
// 返回一个 i18n key 与参数，由组件负责翻译，避免在纯函数里硬编码文案。
export interface GapReason {
  key: "density" | "fresh" | "confidence" | "default";
  params: Record<string, number>;
}

export function gapReason(
  gap: Gap,
  fragments: Fragment[],
): GapReason {
  const support = gap.supportingFragmentIds.length;
  // 最近 7 天内新增的支撑碎片数量（新鲜度）
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const fresh = fragments.filter(
    (f) => gap.supportingFragmentIds.includes(f.id) && new Date(f.createdAt).getTime() >= weekAgo,
  ).length;

  if (fresh >= 2) return { key: "fresh", params: { fresh } };
  if (support >= 4) return { key: "density", params: { count: support } };
  if (gap.confidence >= 0.8) return { key: "confidence", params: { pct: Math.round(gap.confidence * 100) } };
  return { key: "default", params: { count: support } };
}
