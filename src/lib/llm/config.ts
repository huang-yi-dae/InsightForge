// LLM 运行时配置（BYOK：用户自带 Key）。
// 关键设计：这份配置是「运行时数据」，不是部署时环境变量——
// 网页端和桌面端（Tauri）都由用户在设置页自选供应商 + 填 Key + 选模型。
// Key 只存本地（localStorage），绝不写入共享数据库。

export type LLMProviderId = "openai" | "deepseek" | "stepfun" | "siliconflow" | "custom";

export interface LLMConfig {
  provider: LLMProviderId;
  baseUrl: string; // OpenAI 兼容 base（不含 /chat/completions）
  apiKey: string;
  model: string;
}

export interface ProviderPreset {
  id: LLMProviderId;
  label: string;
  baseUrl: string;
  models: string[]; // 常用模型建议（用户仍可自填）
}

// 供应商预设：选了自动填 baseUrl 与建议模型。全部是 OpenAI 兼容接口。
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "stepfun",
    label: "StepFun 阶跃星辰",
    baseUrl: "https://api.stepfun.com/v1",
    models: ["step-2-mini", "step-2-16k", "step-1-flash"],
  },
  {
    id: "siliconflow",
    label: "SiliconFlow 硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V3"],
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    models: [],
  },
];

export const EMPTY_LLM_CONFIG: LLMConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

export function getPreset(id: LLMProviderId): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[0];
}

/** 配置是否可用（有 base + key + model 才能直连）。 */
export function hasLLMConfig(c: LLMConfig | null | undefined): c is LLMConfig {
  return Boolean(c && c.baseUrl.trim() && c.apiKey.trim() && c.model.trim());
}

/**
 * SSRF 防护：判断主机名是否指向内网 / 环回 / 云元数据地址。
 * BYOK「服务端代转」时，用户可自填 baseUrl，若不拦截，攻击者可让服务端
 * 去请求内网资源（如 http://169.254.169.254 云元数据、http://localhost）。
 * 这里对明显的私网/环回/link-local 做黑名单（纯函数，便于单测）。
 */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, ""); // 去掉 IPv6 方括号
  if (!host) return true;
  // 环回与本机
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
  // 内网/保留域名后缀
  if (/\.(internal|local|localhost|intranet|lan)$/.test(host)) return true;
  // IPv4 私有 / 环回 / link-local（含云元数据 169.254.169.254）
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / 云元数据
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  // IPv6 环回/唯一本地地址/link-local
  if (host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  return false;
}

/**
 * 服务端：从请求体的 `llm` 字段安全取出用户 BYOK 配置（用于「服务端代转」）。
 * 只接受基本形状，做长度上限、http(s) 白名单与内网黑名单，防止被当作任意 URL 代理（SSRF）。
 * key 只在本次请求内存中使用、用完即弃——路由绝不落盘、绝不写日志。
 */
export function sanitizeIncomingConfig(raw: unknown): LLMConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const baseUrl = typeof r.baseUrl === "string" ? r.baseUrl.trim().slice(0, 300) : "";
  const apiKey = typeof r.apiKey === "string" ? r.apiKey.trim().slice(0, 400) : "";
  const model = typeof r.model === "string" ? r.model.trim().slice(0, 120) : "";
  if (!baseUrl || !apiKey || !model) return null;
  if (!/^https?:\/\//i.test(baseUrl)) return null;
  // 解析主机名并拦截内网/环回/云元数据（SSRF 防护）。
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }
  if (isBlockedHost(parsed.hostname)) return null;
  return { provider: "custom", baseUrl, apiKey, model };
}
