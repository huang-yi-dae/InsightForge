// 服务端 LLM 客户端 —— 直连 OpenAI 兼容 API（可接 DeepSeek / OpenAI / 任意兼容服务商）。
// 通过环境变量配置：
//   OPENAI_API_KEY   必填，你的 API Key
//   OPENAI_BASE_URL  可选，兼容服务商的 base（默认 https://api.openai.com/v1）
//   OPENAI_MODEL     可选，模型名（默认 gpt-4o-mini）
// 仅在服务端使用，绝不在 "use client" 中导入。

type ChatMessage = {
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

interface ChatResult {
  choices: Array<{ message: { content: string } }>;
}

export async function chatCompletion(input: {
  messages: ChatMessage[];
  temperature?: number;
}): Promise<ChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    // 未配置密钥：让调用方回退到前端预置骨架，而不是抛硬错。
    throw new LLMUnavailableError();
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.6,
      stream: false,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed: ${res.status} ${text.slice(0, 200)}`);
  }

  return (await res.json()) as ChatResult;
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
