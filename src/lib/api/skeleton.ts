import type { Skeleton } from "@/lib/zhizhi/types";
import { hasLLMConfig, type LLMConfig } from "@/lib/llm/config";
import { generateSkeletonDirect, requestExpandDirect } from "@/lib/llm/skeleton";
import { LLMError } from "@/lib/llm/client";

export interface SkeletonRequest {
  gapTitle: string;
  fragments: string[]; // 支撑碎片内容
  identity?: string; // 创作者身份上下文（观点/受众/语气/话题），可空
}

export interface ExpandRequest {
  gapTitle: string;
  heading: string; // 想展开的骨架小节
  fragments: string[];
}

// 直连失败是否值得改走「服务端代转」：跨域/网络类可以（服务端没有浏览器 CORS 限制）；
// 鉴权/空结果类换路径也没用，不重试。
function shouldProxy(e: unknown): boolean {
  return e instanceof LLMError && (e.kind === "cors" || e.kind === "http");
}

// 反代写约束：只返回提纲/要点结构，绝不返回成段文字。
// 策略：有本地 BYOK → 先浏览器直连；被 CORS/网络拦 → 自动带上 config 改走服务端代转；
// 无本地配置 → 直接走服务端路由（回退部署方环境变量）。
export async function generateSkeleton(
  body: SkeletonRequest,
  config?: LLMConfig | null,
): Promise<Skeleton> {
  if (hasLLMConfig(config)) {
    try {
      return await generateSkeletonDirect(config, body.gapTitle, body.fragments, body.identity ?? "");
    } catch (e) {
      if (!shouldProxy(e)) throw e; // auth/empty 等：直连都不行，代转也白搭
      // 落到下方「服务端代转」：把 config 放进 body.llm
    }
  }
  const res = await fetch("/api/skeleton", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hasLLMConfig(config) ? { ...body, llm: config } : body),
  });
  if (!res.ok) throw new Error("skeleton_failed");
  const data = (await res.json()) as { skeleton: Skeleton };
  return data.skeleton;
}

export async function requestExpand(
  body: ExpandRequest,
  config?: LLMConfig | null,
): Promise<string[]> {
  if (hasLLMConfig(config)) {
    try {
      return await requestExpandDirect(config, body.gapTitle, body.heading, body.fragments);
    } catch (e) {
      if (!shouldProxy(e)) throw e;
    }
  }
  const res = await fetch("/api/skeleton/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hasLLMConfig(config) ? { ...body, llm: config } : body),
  });
  if (!res.ok) throw new Error("expand_failed");
  const data = (await res.json()) as { bullets: string[] };
  return data.bullets;
}
