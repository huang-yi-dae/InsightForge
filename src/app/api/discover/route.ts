import { NextRequest } from "next/server";
import { chatCompletion, LLMUnavailableError, type ChatResult } from "@/lib/llm/client";
import { DISCOVER_SYSTEM_PROMPT, buildDiscoverUserPrompt, parseIdeas } from "@/lib/llm/discover";
import { sanitizeIncomingConfig } from "@/lib/llm/config";
import { DISCOVERY } from "@/lib/zhizhi/discovery";
import { hitRateLimit, clientKeyFromHeaders, tooManyRequests } from "@/lib/api/rate-limit";

// 每 IP 每分钟 20 次：足够正常交互，足以阻断脚本刷穿此开放代转路由。
const RATE_RULE = { limit: 20, windowMs: 60_000 };

// 服务端「代转」路由：主路径是浏览器 BYOK 直连；当直连被 CORS 拦截时，前端会带上
// 用户的 llm 配置回退到这里，由服务端代为转发（key 用完即弃，绝不落盘/日志）。
// 若请求未带 llm，则回退部署方的 OPENAI_* 环境变量（可选）。
interface DiscoverBody {
  limit?: number;
  identity?: string;
  clusters?: Array<{ id?: string; label?: string; fragments?: string[] }>;
  llm?: unknown;
}

export async function POST(request: NextRequest) {
  const rl = hitRateLimit(clientKeyFromHeaders(request.headers, "discover"), RATE_RULE);
  if (!rl.ok) return tooManyRequests(rl);

  const body = (await request.json().catch(() => ({}))) as DiscoverBody;
  const limit = Math.min(DISCOVERY.MAX_LIMIT, Math.max(1, Number(body.limit) || DISCOVERY.DEFAULT_LIMIT));
  const identity = typeof body.identity === "string" ? body.identity.slice(0, 800).trim() : "";
  const clusters = Array.isArray(body.clusters)
    ? body.clusters
        .filter((c): c is { id: string; label: string; fragments?: string[] } =>
          Boolean(c && typeof c.id === "string" && typeof c.label === "string"),
        )
        .slice(0, 12)
        .map((c) => ({ id: c.id, label: c.label, fragments: Array.isArray(c.fragments) ? c.fragments : [] }))
    : [];

  if (clusters.length === 0) {
    return Response.json({ error: "no_clusters" }, { status: 400 });
  }

  const validIds = new Set(clusters.map((c) => c.id));

  let result: ChatResult;
  try {
    result = await chatCompletion({
      messages: [
        { role: "system", content: DISCOVER_SYSTEM_PROMPT },
        { role: "user", content: buildDiscoverUserPrompt(clusters, limit, identity) },
      ],
      temperature: 0.5,
      override: sanitizeIncomingConfig(body.llm),
    });
  } catch (error) {
    if (error instanceof LLMUnavailableError) {
      return Response.json(
        { code: "llm_unavailable", message: "AI 未配置，已使用本地启发式发现。" },
        { status: 503 },
      );
    }
    throw error;
  }

  const ideas = parseIdeas(result, validIds, limit);
  if (ideas.length === 0) {
    return Response.json({ code: "empty", message: "AI 未返回可用选题。" }, { status: 502 });
  }
  return Response.json({ ideas });
}
