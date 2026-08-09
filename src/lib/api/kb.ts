import type {
  Cluster,
  Draft,
  Fragment,
  Gap,
  Guardrails,
  Identity,
  Writing,
} from "@/lib/zhizhi/types";

export interface KbState {
  clusters: Cluster[];
  fragments: Fragment[];
  gaps: Gap[];
  drafts: Draft[];
  writings: Writing[];
  guardrails: Guardrails;
  identity?: Identity;
}

export interface KbLoadResult {
  enabled: boolean;
  state?: KbState;
}

// 读取共享知识库；enabled=false 表示未配置数据库，应回退到 localStorage。
// 带超时保护：数据库慢/不可达时不卡住 UI，直接回退本地。
export async function fetchKbState(timeoutMs = 6000): Promise<KbLoadResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("/api/kb", { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return { enabled: false };
    return (await res.json()) as KbLoadResult;
  } catch {
    return { enabled: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function saveKbState(state: KbState): Promise<boolean> {
  try {
    const res = await fetch("/api/kb", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
