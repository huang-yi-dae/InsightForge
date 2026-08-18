import { NextRequest } from "next/server";
import { chatCompletion, LLMUnavailableError, type ChatResult } from "@/lib/llm/client";
import { SKELETON_SYSTEM_PROMPT, buildSkeletonPrompt, parseSkeletonPoints } from "@/lib/llm/skeleton";
import { sanitizeIncomingConfig } from "@/lib/llm/config";
import { hitRateLimit, clientKeyFromHeaders, tooManyRequests } from "@/lib/api/rate-limit";

// 每 IP 每分钟 20 次：足够正常交互，足以阻断脚本刷穿此开放代转路由。
const RATE_RULE = { limit: 20, windowMs: 60_000 };

// 服务端「代转」路由：直连被 CORS 拦时，前端带上用户 llm 配置回退到这里由服务端代转（key 用完即弃）。
// 未带 llm 则回退部署方 OPENAI_* 环境变量。prompt/解析/反代写约束与直连共享 @/lib/llm/skeleton。
interface SkeletonBody {
  gapTitle?: string;
  fragments?: string[];
  identity?: string;
  llm?: unknown;
}

export async function POST(request: NextRequest) {
  const rl = hitRateLimit(clientKeyFromHeaders(request.headers, "skeleton"), RATE_RULE);
  if (!rl.ok) return tooManyRequests(rl);

  const body = (await request.json().catch(() => ({}))) as SkeletonBody;
  const gapTitle = typeof body.gapTitle === "string" ? body.gapTitle.slice(0, 300).trim() : "";
  const fragments = Array.isArray(body.fragments)
    ? body.fragments.filter((f): f is string => typeof f === "string").slice(0, 8).map((f) => f.slice(0, 2000))
    : [];
  const identity = typeof body.identity === "string" ? body.identity.slice(0, 800).trim() : "";

  if (!gapTitle) {
    return Response.json({ error: "missing gapTitle" }, { status: 400 });
  }

  let result: ChatResult;
  try {
    result = await chatCompletion({
      messages: [
        { role: "system", content: SKELETON_SYSTEM_PROMPT },
        { role: "user", content: buildSkeletonPrompt(gapTitle, fragments, identity) },
      ],
      temperature: 0.6,
      override: sanitizeIncomingConfig(body.llm),
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

  const points = parseSkeletonPoints(result);
  if (points.length === 0) {
    return Response.json({ error: "empty_skeleton" }, { status: 502 });
  }
  return Response.json({ skeleton: { points, generatedAt: new Date().toISOString() } });
}
