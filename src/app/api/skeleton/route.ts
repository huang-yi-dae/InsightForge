import { NextRequest } from "next/server";
import { chatCompletion, extractJson, LLMUnavailableError } from "@/lib/llm/client";

// 反代写硬约束：只输出提纲结构（heading + 简短 bullet 要点），绝不输出成段文字。
const SYSTEM_PROMPT = `你是「织知」的写作骨架助手。你的唯一职责是给出【提纲骨架】，绝不代写成段文字。
硬性规则：
1. 只输出提纲：每个小节一个 heading，加 1-3 条极简 bullet 要点（每条不超过 12 个字）。
2. 严禁写出任何成段的正文、句子或过渡文字；bullet 只能是「提示词/要点」，不能是完整句子。
3. 用中文。骨架要贴合用户的知识库碎片，但只提炼「该写什么」，不替他写。
只返回如下 JSON，不要任何解释或 markdown 包裹：
{"points":[{"heading":"小节标题","bullets":["要点1","要点2"]}]}`;

interface SkeletonBody {
  gapTitle?: string;
  fragments?: string[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SkeletonBody;
  const gapTitle = typeof body.gapTitle === "string" ? body.gapTitle : "";
  const fragments = Array.isArray(body.fragments) ? body.fragments.slice(0, 8) : [];

  if (!gapTitle) {
    return Response.json({ error: "missing gapTitle" }, { status: 400 });
  }

  const userPrompt = `写作主题（一个「空白」）：${gapTitle}
相关碎片素材：
${fragments.map((f, i) => `${i + 1}. ${f}`).join("\n")}

请给出这篇文章的提纲骨架（只出提纲要点，不要成段文字）。`;

  let result;
  try {
    result = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    });
  } catch (error) {
    if (error instanceof LLMUnavailableError) {
      return Response.json(
        { code: "llm_unavailable", message: "AI 未配置，已使用预置骨架。" },
        { status: 503 },
      );
    }
    throw error;
  }

  const raw = result.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ points?: Array<{ heading?: string; bullets?: string[] }> }>(raw);
  const points = (parsed?.points ?? [])
    .filter((p) => p && typeof p.heading === "string")
    .map((p) => ({
      heading: String(p.heading),
      bullets: Array.isArray(p.bullets) ? p.bullets.slice(0, 3).map(String) : [],
    }));

  if (points.length === 0) {
    return Response.json({ error: "empty_skeleton" }, { status: 502 });
  }

  return Response.json({
    skeleton: { points, generatedAt: new Date().toISOString() },
  });
}
