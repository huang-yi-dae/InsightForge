// 「写作骨架 / 请求展开」的共享 LLM 逻辑：prompt 构建 + 解析 + 浏览器直连。
// 服务端路由（/api/skeleton、/api/skeleton/expand）与前端 BYOK 直连复用同一份，
// 保证网页端与桌面端行为完全一致，且反代写硬约束（只出提纲/要点）只写一次。

import type { Skeleton } from "@/lib/zhizhi/types";
import { callChat, extractJson, type ChatResult } from "./client";
import type { LLMConfig } from "./config";

// ── 骨架 ──
export const SKELETON_SYSTEM_PROMPT = `你是「织知」的写作骨架助手。你的唯一职责是给出【提纲骨架】，绝不代写成段文字。
硬性规则：
1. 只输出提纲：每个小节一个 heading，加 1-3 条极简 bullet 要点（每条不超过 12 个字）。
2. 严禁写出任何成段的正文、句子或过渡文字；bullet 只能是「提示词/要点」，不能是完整句子。
3. 用中文。骨架要贴合用户的知识库碎片，但只提炼「该写什么」，不替他写。
只返回如下 JSON，不要任何解释或 markdown 包裹：
{"points":[{"heading":"小节标题","bullets":["要点1","要点2"]}]}`;

export function buildSkeletonPrompt(gapTitle: string, fragments: string[], identity: string): string {
  const identityBlock = identity
    ? `\n\n创作者身份档案（用于让提纲的取向、切入点更贴合作者，但仍只出提纲、不得代写）：\n${identity}`
    : "";
  return `写作主题（一个「空白」）：${gapTitle}
相关碎片素材：
${fragments.map((f, i) => `${i + 1}. ${f}`).join("\n")}${identityBlock}

请给出这篇文章的提纲骨架（只出提纲要点，不要成段文字）。`;
}

export function parseSkeletonPoints(result: ChatResult): Skeleton["points"] {
  const raw = result.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ points?: Array<{ heading?: string; bullets?: string[] }> }>(raw);
  return (parsed?.points ?? [])
    .filter((p) => p && typeof p.heading === "string")
    .map((p) => ({
      heading: String(p.heading),
      bullets: Array.isArray(p.bullets) ? p.bullets.slice(0, 3).map(String) : [],
    }));
}

export async function generateSkeletonDirect(
  config: LLMConfig,
  gapTitle: string,
  fragments: string[],
  identity: string,
): Promise<Skeleton> {
  const result = await callChat(config, {
    messages: [
      { role: "system", content: SKELETON_SYSTEM_PROMPT },
      { role: "user", content: buildSkeletonPrompt(gapTitle, fragments, identity) },
    ],
    temperature: 0.6,
  });
  const points = parseSkeletonPoints(result);
  if (points.length === 0) throw new Error("empty_skeleton");
  return { points, generatedAt: new Date().toISOString() };
}

// ── 请求展开 ──
export const EXPAND_SYSTEM_PROMPT = `你是「织知」的写作提示助手。用户想展开某个小节，但你只能给【要点提示】，不能代写。
硬性规则：
1. 只返回 2-4 条极简 bullet 要点提示，每条不超过 14 个字。
2. 严禁写出成段文字或完整句子；提示只帮用户想到「该写什么」。
3. 用中文。
只返回 JSON：{"bullets":["提示1","提示2"]}`;

export function buildExpandPrompt(gapTitle: string, heading: string, fragments: string[]): string {
  return `文章主题：${gapTitle}
要展开的小节：${heading}
相关碎片：
${fragments.map((f, i) => `${i + 1}. ${f}`).join("\n")}

请给出展开这个小节的要点提示（只出要点，不要成段文字）。`;
}

export function parseExpandBullets(result: ChatResult): string[] {
  const raw = result.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ bullets?: string[] }>(raw);
  return Array.isArray(parsed?.bullets) ? parsed!.bullets.slice(0, 4).map(String).filter(Boolean) : [];
}

export async function requestExpandDirect(
  config: LLMConfig,
  gapTitle: string,
  heading: string,
  fragments: string[],
): Promise<string[]> {
  const result = await callChat(config, {
    messages: [
      { role: "system", content: EXPAND_SYSTEM_PROMPT },
      { role: "user", content: buildExpandPrompt(gapTitle, heading, fragments) },
    ],
    temperature: 0.7,
  });
  const bullets = parseExpandBullets(result);
  if (bullets.length === 0) throw new Error("empty_expand");
  return bullets;
}
