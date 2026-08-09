import { NextRequest } from "next/server";
import { appAiChat, AppAIUnavailableError, extractJson } from "@/lib/app-ai/client";

// 请求展开：仍然只给「要点提示」，绝不给成段文字，也不能整段插入画布。
const SYSTEM_PROMPT = `你是「织知」的写作提示助手。用户想展开某个小节，但你只能给【要点提示】，不能代写。
硬性规则：
1. 只返回 2-4 条极简 bullet 要点提示，每条不超过 14 个字。
2. 严禁写出成段文字或完整句子；提示只帮用户想到「该写什么」。
3. 用中文。
只返回 JSON：{"bullets":["提示1","提示2"]}`;

interface ExpandBody {
  gapTitle?: string;
  heading?: string;
  fragments?: string[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ExpandBody;
  const heading = typeof body.heading === "string" ? body.heading : "";
  const gapTitle = typeof body.gapTitle === "string" ? body.gapTitle : "";
  const fragments = Array.isArray(body.fragments) ? body.fragments.slice(0, 6) : [];

  if (!heading) {
    return Response.json({ error: "missing heading" }, { status: 400 });
  }

  const userPrompt = `文章主题：${gapTitle}
要展开的小节：${heading}
相关碎片：
${fragments.map((f, i) => `${i + 1}. ${f}`).join("\n")}

请给出展开这个小节的要点提示（只出要点，不要成段文字）。`;

  let result;
  try {
    result = await appAiChat({
      capability: "text",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      params: { temperature: 0.7 },
    });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return Response.json(
        { code: "app_ai_unavailable", message: "AI 功能暂时不可用。" },
        { status: 402 },
      );
    }
    throw error;
  }

  const raw = result.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ bullets?: string[] }>(raw);
  const bullets = Array.isArray(parsed?.bullets)
    ? parsed!.bullets.slice(0, 4).map(String).filter(Boolean)
    : [];

  if (bullets.length === 0) {
    return Response.json({ error: "empty_expand" }, { status: 502 });
  }

  return Response.json({ bullets });
}
