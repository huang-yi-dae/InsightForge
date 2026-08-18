import { NextRequest } from "next/server";
import { chatCompletion, LLMUnavailableError, type ChatResult } from "@/lib/llm/client";
import { EXPAND_SYSTEM_PROMPT, buildExpandPrompt, parseExpandBullets } from "@/lib/llm/skeleton";
import { sanitizeIncomingConfig } from "@/lib/llm/config";
import { hitRateLimit, clientKeyFromHeaders, tooManyRequests } from "@/lib/api/rate-limit";

// 每 IP 每分钟 20 次：足够正常交互，足以阻断脚本刷穿此开放代转路由。
const RATE_RULE = { limit: 20, windowMs: 60_000 };

// 服务端「代转」路由：直连被 CORS 拦时前端带上用户 llm 配置回退到这里由服务端代转（key 用完即弃）。
// prompt/解析/反代写约束与直连共享 @/lib/llm/skeleton。
interface ExpandBody {
  gapTitle?: string;
  heading?: string;
  fragments?: string[];
  llm?: unknown;
}

export async function POST(request: NextRequest) {
  const rl = hitRateLimit(clientKeyFromHeaders(request.headers, "expand"), RATE_RULE);
  if (!rl.ok) return tooManyRequests(rl);

  const body = (await request.json().catch(() => ({}))) as ExpandBody;
  const heading = typeof body.heading === "string" ? body.heading.slice(0, 300).trim() : "";
  const gapTitle = typeof body.gapTitle === "string" ? body.gapTitle.slice(0, 300).trim() : "";
  const fragments = Array.isArray(body.fragments)
    ? body.fragments.filter((f): f is string => typeof f === "string").slice(0, 6).map((f) => f.slice(0, 2000))
    : [];

  if (!heading) {
    return Response.json({ error: "missing heading" }, { status: 400 });
  }

  let result: ChatResult;
  try {
    result = await chatCompletion({
      messages: [
        { role: "system", content: EXPAND_SYSTEM_PROMPT },
        { role: "user", content: buildExpandPrompt(gapTitle, heading, fragments) },
      ],
      temperature: 0.7,
      override: sanitizeIncomingConfig(body.llm),
    });
  } catch (error) {
    if (error instanceof LLMUnavailableError) {
      return Response.json(
        { code: "llm_unavailable", message: "AI 未配置，已使用预置提示。" },
        { status: 503 },
      );
    }
    throw error;
  }

  const bullets = parseExpandBullets(result);
  if (bullets.length === 0) {
    return Response.json({ error: "empty_expand" }, { status: 502 });
  }
  return Response.json({ bullets });
}
