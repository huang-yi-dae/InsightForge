// 服务端 App AI 客户端 —— 通过 Creator App AI 计费代理调用，按 capability 选模型。
// 仅在服务端使用，绝不在 "use client" 中导入。

type AppAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class AppAIUnavailableError extends Error {
  readonly code = "app_ai_unavailable";
  constructor() {
    super("App AI is unavailable");
    this.name = "AppAIUnavailableError";
  }
}

interface ChatResult {
  choices: Array<{ message: { content: string } }>;
}

export async function appAiChat(input: {
  capability?: "text" | "vision" | "image_generation";
  messages: AppAiMessage[];
  params?: Record<string, unknown>;
}): Promise<ChatResult> {
  const platformBase = process.env.EAZO_APP_AI_API_BASE?.replace(/\/$/, "");
  const appId = process.env.EAZO_APP_ID || process.env.NEXT_PUBLIC_EAZO_APP_ID;
  const privateKey = process.env.EAZO_PRIVATE_KEY;
  const capability = input.capability ?? "text";
  const modelMap = process.env.EAZO_AI_MODELS_JSON
    ? (JSON.parse(process.env.EAZO_AI_MODELS_JSON) as Record<string, string>)
    : {};
  const modelKey =
    typeof modelMap[capability] === "string" ? modelMap[capability] : process.env.EAZO_AI_MODEL_KEY;

  if (!platformBase || !appId || !privateKey || !modelKey) {
    throw new Error("App AI is not configured.");
  }

  const res = await fetch(`${platformBase}/api/app-ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-eazo-app-id": appId,
      Authorization: `Bearer ${privateKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      model_key: modelKey,
      messages: input.messages,
      stream: false,
      params: input.params ?? {},
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.clone().json().catch(() => null)) as
      | { code?: string; detail?: { code?: string } }
      | null;
    const code = body?.detail?.code ?? body?.code;
    if (res.status === 402 && code === "app_ai_unavailable") {
      throw new AppAIUnavailableError();
    }
    const text = await res.text().catch(() => "");
    throw new Error(`App AI request failed: ${res.status} ${text.slice(0, 200)}`);
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
