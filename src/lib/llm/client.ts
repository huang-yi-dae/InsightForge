// OpenAI 兼容 LLM 客户端。核心 callChat 是「同构」的——
// 既能在服务端路由里跑，也能在浏览器里直连（BYOK 前端直连，为桌面端复用铺路）。
//
// 两种入口：
//   callChat(config, {messages})  —— 显式传配置（前端直连用；桌面端与网页端同一套逻辑）
//   chatCompletion({messages})    —— 从环境变量取配置（服务端路由「可选代理」用）

import type { LLMConfig } from "./config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class LLMUnavailableError extends Error {
  readonly code = "llm_unavailable";
  constructor() {
    super("LLM is not configured");
    this.name = "LLMUnavailableError";
  }
}

// 直连失败的分类错误：让 UI 能给出可行动的提示，而不是静默降级。
//  cors    —— 浏览器跨域被拦（供应商不允许前端直连）
//  auth    —— key 无效 / 无权限（401/403）
//  timeout —— 请求超时/被中断
//  http    —— 其它 HTTP 错误（含限流 429、5xx）
//  empty   —— 连上了但模型没返回可用内容
export type LLMErrorKind = "cors" | "auth" | "timeout" | "http" | "empty";
export class LLMError extends Error {
  constructor(
    readonly kind: LLMErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export interface ChatResult {
  choices: Array<{ message: { content: string } }>;
}

interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

// 同构核心：给定配置直接打 /chat/completions。浏览器与服务端通用。
// 失败时抛分类 LLMError，便于 UI 区分「跨域/鉴权/超时/其它」并给出可行动提示。
export async function callChat(config: LLMConfig, opts: ChatOptions): Promise<ChatResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.6,
        stream: false,
      }),
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    // fetch reject：区分「主动中断/超时」与「网络/跨域」。
    // 浏览器里被 CORS 拦截时，fetch 抛的是 TypeError（"Failed to fetch"），
    // 无法从 JS 侧读到具体状态——这是最常见的 BYOK 直连坑，单独归为 cors。
    if (opts.signal?.aborted || (e as Error)?.name === "AbortError") {
      throw new LLMError("timeout", "请求超时或被中断");
    }
    throw new LLMError(
      "cors",
      "浏览器无法直连该供应商（可能是跨域 CORS 限制或网络不可达）",
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new LLMError("auth", `鉴权失败（${res.status}）：API Key 可能无效或无权限`, res.status);
    }
    throw new LLMError("http", `请求失败：${res.status} ${text.slice(0, 160)}`, res.status);
  }
  return (await res.json()) as ChatResult;
}

// 服务端路由用：从环境变量读取配置。未配 Key 抛 LLMUnavailableError，让调用方回退。
// 服务端路由用：优先使用传入的 override 配置（用户 BYOK「服务端代转」），
// 否则回退环境变量。两者都没有则抛 LLMUnavailableError，让调用方回退本地启发式。
export async function chatCompletion(input: {
  messages: ChatMessage[];
  temperature?: number;
  override?: LLMConfig | null;
}): Promise<ChatResult> {
  let config: LLMConfig | null = input.override ?? null;
  if (!config) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new LLMUnavailableError();
    config = {
      provider: "custom",
      apiKey,
      baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }
  return callChat(config, { messages: input.messages, temperature: input.temperature });
}

// 从模型返回文本里安全抽取 JSON（容忍 ```json 包裹）
export function extractJson<T>(text: string): T | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  const candidate =
    start !== -1 && end !== -1
      ? cleaned.slice(start, end + 1)
      : arrStart !== -1 && arrEnd !== -1
        ? cleaned.slice(arrStart, arrEnd + 1)
        : cleaned;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
