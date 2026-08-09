import type {
  Cluster,
  Draft,
  Fragment,
  Gap,
  Guardrails,
  Writing,
} from "@/lib/zhizhi/types";

export interface KbState {
  clusters: Cluster[];
  fragments: Fragment[];
  gaps: Gap[];
  drafts: Draft[];
  writings: Writing[];
  guardrails: Guardrails;
}

export interface KbLoadResult {
  enabled: boolean;
  state?: KbState;
}

// 读取共享知识库；enabled=false 表示未配置数据库，应回退到 localStorage。
export async function fetchKbState(): Promise<KbLoadResult> {
  try {
    const res = await fetch("/api/kb", { cache: "no-store" });
    if (!res.ok) return { enabled: false };
    return (await res.json()) as KbLoadResult;
  } catch {
    return { enabled: false };
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
