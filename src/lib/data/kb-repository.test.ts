import { describe, it, expect } from "vitest";
import {
  resolveBackend,
  readLocalState,
  writeLocalState,
  HybridKbRepository,
  KB_STORAGE_KEY,
  type StorageLike,
  type KbTransport,
  type KbState,
} from "./kb-repository";
import { DEFAULT_GUARDRAILS } from "@/lib/zhizhi/types";

function emptyState(tag = "x"): KbState {
  return {
    clusters: [],
    fragments: [],
    gaps: [],
    drafts: [],
    writings: [{ id: tag, draftId: "d", gapId: "g", title: tag, content: "", userWords: 1, aiWords: 0, publishedAt: "2026-01-01T00:00:00.000Z", reflowed: true }],
    guardrails: { ...DEFAULT_GUARDRAILS },
  };
}

function fakeStorage(seed?: Record<string, string>): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

function fakeTransport(over: Partial<KbTransport> = {}): KbTransport {
  return {
    fetchState: over.fetchState ?? (async () => ({ enabled: false })),
    saveState: over.saveState ?? (async () => true),
  };
}

describe("resolveBackend", () => {
  it("桌面端永远 local", () => {
    expect(resolveBackend(true, true)).toBe("local");
    expect(resolveBackend(true, false)).toBe("local");
  });
  it("网页端按远程可用性", () => {
    expect(resolveBackend(false, true)).toBe("remote");
    expect(resolveBackend(false, false)).toBe("local");
  });
});

describe("readLocalState / writeLocalState", () => {
  it("round-trip", () => {
    const s = fakeStorage();
    writeLocalState(s, emptyState("a"));
    expect(readLocalState(s)?.writings[0].id).toBe("a");
  });
  it("无 storage 返回 null / 不抛", () => {
    expect(readLocalState(null)).toBeNull();
    expect(() => writeLocalState(null, emptyState())).not.toThrow();
  });
  it("损坏 JSON 返回 null", () => {
    expect(readLocalState(fakeStorage({ [KB_STORAGE_KEY]: "{bad" }))).toBeNull();
  });
});

describe("HybridKbRepository - 桌面端", () => {
  it("load 走本地、不碰 transport；save 写本地", async () => {
    let fetched = false;
    const storage = fakeStorage({ [KB_STORAGE_KEY]: JSON.stringify(emptyState("local1")) });
    const transport = fakeTransport({ fetchState: async () => { fetched = true; return { enabled: true, state: emptyState("remote") }; } });
    const repo = new HybridKbRepository(true, transport, storage);
    const loaded = await repo.load();
    expect(fetched).toBe(false);
    expect(loaded.source).toBe("local");
    expect(loaded.state?.writings[0].id).toBe("local1");
    await repo.save(emptyState("local2"));
    expect(readLocalState(storage)?.writings[0].id).toBe("local2");
  });
});

describe("HybridKbRepository - 网页端远程可用", () => {
  it("load 返回远程状态；save 走 transport", async () => {
    let saved: KbState | null = null;
    const storage = fakeStorage();
    const transport = fakeTransport({
      fetchState: async () => ({ enabled: true, state: emptyState("remote1") }),
      saveState: async (s) => { saved = s; return true; },
    });
    const repo = new HybridKbRepository(false, transport, storage);
    const loaded = await repo.load();
    expect(loaded.source).toBe("remote");
    expect(loaded.state?.writings[0].id).toBe("remote1");
    await repo.save(emptyState("remote2"));
    expect(saved!.writings[0].id).toBe("remote2");
    // 远程模式不应写本地
    expect(storage.data.has(KB_STORAGE_KEY)).toBe(false);
  });
});

describe("HybridKbRepository - 网页端远程不可用则回退本地", () => {
  it("enabled=false → local", async () => {
    const storage = fakeStorage({ [KB_STORAGE_KEY]: JSON.stringify(emptyState("cached")) });
    const repo = new HybridKbRepository(false, fakeTransport({ fetchState: async () => ({ enabled: false }) }), storage);
    const loaded = await repo.load();
    expect(loaded.source).toBe("local");
    expect(loaded.state?.writings[0].id).toBe("cached");
  });
  it("fetch 抛错 → local", async () => {
    const repo = new HybridKbRepository(false, fakeTransport({ fetchState: async () => { throw new Error("network"); } }), fakeStorage());
    expect((await repo.load()).source).toBe("local");
  });
  it("远程 save 失败 → 兜底写本地", async () => {
    const storage = fakeStorage();
    const transport = fakeTransport({
      fetchState: async () => ({ enabled: true, state: emptyState("r") }),
      saveState: async () => false,
    });
    const repo = new HybridKbRepository(false, transport, storage);
    await repo.load(); // 确定为 remote
    await repo.save(emptyState("fallback"));
    expect(readLocalState(storage)?.writings[0].id).toBe("fallback");
  });
});
