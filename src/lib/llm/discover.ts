// 「选题发现」的共享逻辑：prompt 构建 + 结果解析。
// 服务端路由（/api/discover）与浏览器直连（store.discoverNewGapsAI）复用同一份，
// 保证网页端与桌面端行为完全一致。

import type { AiIdea } from "@/lib/zhizhi/discovery";
import { callChat, extractJson, type ChatResult } from "./client";
import type { LLMConfig } from "./config";

export interface DiscoverClusterInput {
  id: string;
  label: string;
  fragments: string[];
}

export const DISCOVER_SYSTEM_PROMPT = `你是「织知」的选题发现助手。用户会给你若干「知识簇」（一个主题标签 + 该主题下的碎片摘录）。
你的职责：通读这些碎片，找出「素材已经够、但还没被写成文章」的可写选题。
硬性规则：
1. 每个选题要贴合碎片里真实出现的观点/事实，不要凭空发挥。
2. 选题标题要具体、有观点或角度，不要泛泛（如「关于成长的思考」这种不行）。
3. 每个选题给出 confidence（0-1，素材越足越自信）与一句 reason（为什么现在值得写，不超过 30 字）。
4. 只从我给的簇里选，clusterId 必须来自输入。
只返回如下 JSON，不要任何解释或 markdown 包裹：
{"ideas":[{"title":"选题标题","clusterId":"簇ID","confidence":0.7,"reason":"一句话理由"}]}`;

export function buildDiscoverUserPrompt(
  clusters: DiscoverClusterInput[],
  limit: number,
  identity: string,
): string {
  const identityBlock = identity
    ? `\n\n创作者身份档案（用于让选题更贴合作者的观点/受众/语气）：\n${identity}`
    : "";
  const clusterBlock = clusters
    .map((c) => {
      const frags = Array.isArray(c.fragments) ? c.fragments.slice(0, 6) : [];
      return `簇ID: ${c.id}\n主题: ${c.label}\n碎片:\n${
        frags.map((f, i) => `  ${i + 1}. ${f}`).join("\n") || "  （暂无碎片）"
      }`;
    })
    .join("\n\n");
  return `以下是我的知识库（按簇分组）：\n\n${clusterBlock}${identityBlock}\n\n请从中发现最多 ${limit} 个「素材够、值得写」的可写选题。`;
}

// 把模型返回解析成受约束的 AiIdea[]（过滤非法 clusterId、夹逼 confidence、截断长度）。
export function parseIdeas(
  result: ChatResult,
  validIds: Set<string>,
  limit: number,
): AiIdea[] {
  const raw = result.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ ideas?: Array<Partial<AiIdea>> }>(raw);
  return (parsed?.ideas ?? [])
    .filter((it) => it && typeof it.title === "string" && typeof it.clusterId === "string")
    .filter((it) => validIds.has(it.clusterId as string))
    .map((it) => ({
      title: String(it.title).slice(0, 80),
      clusterId: String(it.clusterId),
      confidence: Math.min(0.99, Math.max(0.4, Number(it.confidence) || 0.6)),
      reason: typeof it.reason === "string" ? it.reason.slice(0, 60) : "",
    }))
    .slice(0, limit);
}

// 浏览器直连：用用户本地配置直接向 LLM 要选题。返回受约束的 ideas。
export async function discoverIdeasDirect(
  config: LLMConfig,
  clusters: DiscoverClusterInput[],
  limit: number,
  identity: string,
  signal?: AbortSignal,
): Promise<AiIdea[]> {
  const validIds = new Set(clusters.map((c) => c.id));
  const result = await callChat(config, {
    messages: [
      { role: "system", content: DISCOVER_SYSTEM_PROMPT },
      { role: "user", content: buildDiscoverUserPrompt(clusters, limit, identity) },
    ],
    temperature: 0.5,
    signal,
  });
  return parseIdeas(result, validIds, limit);
}
