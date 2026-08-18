// 统一数据访问层（REST 风格）。
//
// 目标：网页端与桌面端上层都通过同一套 Repository 接口读写知识库整库状态，
// 不再让 store 直接分辨「fetch /api」还是「localStorage」。
//   · 网页端：RemoteKbRepository → fetch /api/kb（REST）
//   · 桌面端（Tauri 静态导出，无服务端）：LocalKbRepository → localStorage
//   · 网页端但未配 DATABASE_URL：远程探测返回 enabled:false → 回退本地
//
// 关键判定（后端选择/回退）抽成纯函数，storage/fetch 用可注入适配器，便于单测。

import { fetchKbState, saveKbState, type KbLoadResult, type KbState } from "@/lib/api/kb";

export type { KbState };

export const KB_STORAGE_KEY = "zhizhi-state-v1";

export type KbSource = "remote" | "local";

export interface KbLoad {
  /** 本次数据来自哪个后端；save 时据此决定写回哪里。 */
  source: KbSource;
  /** 命中的整库状态；null 表示该后端无数据（上层用 seed/本地缓存）。 */
  state: KbState | null;
}

export interface KbRepository {
  load(): Promise<KbLoad>;
  save(state: KbState): Promise<void>;
}

/**
 * 纯函数：根据「是否桌面」与「远程是否可用」决定用哪个后端。
 * - 桌面端永远 local（没有服务端）。
 * - 网页端：远程 enabled → remote，否则 local。
 */
export function resolveBackend(isDesktop: boolean, remoteEnabled: boolean): KbSource {
  if (isDesktop) return "local";
  return remoteEnabled ? "remote" : "local";
}

// ---- 可注入适配器（默认走真实实现，测试可替换） ----

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface KbTransport {
  fetchState(): Promise<KbLoadResult>;
  saveState(state: KbState): Promise<boolean>;
}

const defaultTransport: KbTransport = {
  fetchState: () => fetchKbState(),
  saveState: (s) => saveKbState(s),
};

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLocalState(storage: StorageLike | null): KbState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KB_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KbState;
  } catch {
    return null;
  }
}

export function writeLocalState(storage: StorageLike | null, state: KbState): void {
  if (!storage) return;
  try {
    storage.setItem(KB_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 配额/不可用时静默失败——内存中状态仍有效 */
  }
}

/**
 * 混合实现：对上层暴露统一 REST 风格接口，内部按环境选择远程或本地，
 * 并记住本次会话确定的后端，save 时写回同一后端。
 */
export class HybridKbRepository implements KbRepository {
  private backend: KbSource | null = null;

  constructor(
    private readonly isDesktop: boolean,
    private readonly transport: KbTransport = defaultTransport,
    private readonly storage: StorageLike | null = browserStorage(),
  ) {}

  async load(): Promise<KbLoad> {
    // 桌面端：直接本地，不做远程探测。
    if (this.isDesktop) {
      this.backend = "local";
      return { source: "local", state: readLocalState(this.storage) };
    }
    // 网页端：探测远程；不可用则回退本地。
    let remoteEnabled = false;
    let remoteState: KbState | null = null;
    try {
      const res = await this.transport.fetchState();
      remoteEnabled = Boolean(res.enabled && res.state);
      remoteState = res.state ?? null;
    } catch {
      remoteEnabled = false;
    }
    this.backend = resolveBackend(false, remoteEnabled);
    if (this.backend === "remote") {
      return { source: "remote", state: remoteState };
    }
    return { source: "local", state: readLocalState(this.storage) };
  }

  async save(state: KbState): Promise<void> {
    // 未 load 先 save 时按环境兜底判定。
    const backend = this.backend ?? (this.isDesktop ? "local" : "remote");
    if (backend === "remote") {
      const ok = await this.transport.saveState(state);
      // 远程保存失败时兜底写本地，避免数据丢失。
      if (!ok) writeLocalState(this.storage, state);
      return;
    }
    writeLocalState(this.storage, state);
  }

  /** 当前会话已确定的后端（load 之后有值），供上层决定即时保存策略。 */
  currentSource(): KbSource | null {
    return this.backend;
  }
}

/** 工厂：按运行环境创建统一数据层。isDesktop 默认读编译期常量。 */
export function createKbRepository(
  isDesktop: boolean = process.env.NEXT_PUBLIC_DESKTOP === "1",
): HybridKbRepository {
  return new HybridKbRepository(isDesktop);
}
