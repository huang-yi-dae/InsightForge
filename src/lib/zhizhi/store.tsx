"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GUARDRAILS,
  aiRatio,
  countWords,
  type Cluster,
  type Draft,
  type Fragment,
  type Gap,
  type Guardrails,
  type Skeleton,
  type Writing,
} from "./types";
import { SEED_CLUSTERS, SEED_DRAFTS, SEED_FRAGMENTS, SEED_GAPS, SEED_WRITINGS } from "./sample-library";
import { fetchKbState, saveKbState, type KbState } from "@/lib/api/kb";

const STORAGE_KEY = "zhizhi-state-v1";

interface PersistShape {
  clusters?: Cluster[];
  drafts: Draft[];
  writings: Writing[];
  gaps: Gap[];
  fragments: Fragment[];
  guardrails: Guardrails;
}

interface StoreValue {
  ready: boolean;
  clusters: Cluster[];
  fragments: Fragment[];
  gaps: Gap[];
  drafts: Draft[];
  writings: Writing[];
  guardrails: Guardrails;
  // 查询
  getGap: (id: string) => Gap | undefined;
  getDraft: (id: string) => Draft | undefined;
  getFragment: (id: string) => Fragment | undefined;
  fragmentsForGap: (gapId: string) => Fragment[];
  // 动作
  ensureDraftForGap: (gapId: string) => string; // 返回 draftId
  setDraftContent: (draftId: string, content: string) => void;
  setDraftSkeleton: (draftId: string, skeleton: Skeleton) => void;
  citeFragment: (draftId: string, fragmentId: string) => void;
  expandSkeleton: (draftId: string, addedAiWords: number) => void;
  publishDraft: (draftId: string) => Writing | undefined;
  setGuardrails: (g: Partial<Guardrails>) => void;
  todayInflow: number;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadPersist(): PersistShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistShape;
  } catch {
    return null;
  }
}

export function ZhizhiProvider({ children }: { children: React.ReactNode }) {
  // 关键：SSR 与客户端首帧必须一致，否则 hydration 不匹配会导致事件绑定丢失
  // （页面显示正常但点不动）。因此初始一律用 seed 数据、ready=false，
  // localStorage / DB 的读取全部放到只在客户端执行的 useEffect 里。
  const [fragments, setFragments] = useState<Fragment[]>(SEED_FRAGMENTS);
  const [gaps, setGaps] = useState<Gap[]>(SEED_GAPS);
  const [drafts, setDrafts] = useState<Draft[]>(SEED_DRAFTS);
  const [writings, setWritings] = useState<Writing[]>(SEED_WRITINGS);
  const [guardrails, setGuardrailsState] = useState<Guardrails>(DEFAULT_GUARDRAILS);
  const [clusters, setClusters] = useState<Cluster[]>(SEED_CLUSTERS);
  const [ready, setReady] = useState<boolean>(false);
  const hydrated = useRef(false);
  // 持久化后端：加载完成前为 null；DB 可用 → "db"，否则 → "local"。
  const backend = useRef<"db" | "local" | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 仅客户端：先用 localStorage 立即水合（保证离线/无 DB 时秒开），
  // 再异步探测 DB；DB 可用则以共享库覆盖。任一分支都在最后置 ready=true。
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 让 setState 不再"同步发生在 effect 体内"，规避级联渲染告警。
      await Promise.resolve();
      if (cancelled) return;

      // 1) 本地缓存先行水合
      const local = loadPersist();
      if (local) {
        if (local.clusters?.length) setClusters(local.clusters);
        if (local.fragments?.length) setFragments(local.fragments);
        if (local.gaps?.length) setGaps(local.gaps);
        if (local.drafts?.length) setDrafts(local.drafts);
        if (local.writings?.length) setWritings(local.writings);
        if (local.guardrails) setGuardrailsState({ ...DEFAULT_GUARDRAILS, ...local.guardrails });
      }

      // 2) 探测后端
      const result = await fetchKbState();
      if (cancelled) return;
      if (result.enabled && result.state) {
        const s = result.state;
        setClusters(s.clusters);
        setFragments(s.fragments);
        setGaps(s.gaps);
        setDrafts(s.drafts);
        setWritings(s.writings);
        setGuardrailsState({ ...DEFAULT_GUARDRAILS, ...s.guardrails });
        backend.current = "db";
      } else {
        backend.current = "local";
      }
      hydrated.current = true;
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 持久化：DB 模式防抖 PUT，本地模式写 localStorage。
  useEffect(() => {
    if (!hydrated.current || !backend.current) return;
    const snapshot: KbState = { clusters, fragments, gaps, drafts, writings, guardrails };
    if (backend.current === "db") {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveKbState(snapshot);
      }, 600);
    } else {
      const payload: PersistShape = { clusters, drafts, writings, gaps, fragments, guardrails };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore quota */
      }
    }
  }, [clusters, drafts, writings, gaps, fragments, guardrails]);

  const getGap = useCallback((id: string) => gaps.find((g) => g.id === id), [gaps]);
  const getDraft = useCallback((id: string) => drafts.find((d) => d.id === id), [drafts]);
  const getFragment = useCallback((id: string) => fragments.find((f) => f.id === id), [fragments]);
  const fragmentsForGap = useCallback(
    (gapId: string) => {
      const g = gaps.find((x) => x.id === gapId);
      if (!g) return [];
      return g.supportingFragmentIds
        .map((fid) => fragments.find((f) => f.id === fid))
        .filter((f): f is Fragment => Boolean(f));
    },
    [gaps, fragments],
  );

  const ensureDraftForGap = useCallback(
    (gapId: string) => {
      const existing = drafts.find((d) => d.gapId === gapId && d.status === "drafting");
      if (existing) return existing.id;
      const gap = gaps.find((g) => g.id === gapId);
      const id = `draft-${gapId}-${Date.now()}`;
      const draft: Draft = {
        id,
        gapId,
        title: gap?.title ?? "未命名草稿",
        content: "",
        userWords: 0,
        aiWords: 0,
        expandUses: 0,
        citedFragmentIds: [],
        updatedAt: new Date().toISOString(),
        status: "drafting",
      };
      setDrafts((prev) => [...prev, draft]);
      setGaps((prev) => prev.map((g) => (g.id === gapId ? { ...g, status: "drafting", draftId: id } : g)));
      return id;
    },
    [drafts, gaps],
  );

  const setDraftContent = useCallback((draftId: string, content: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? { ...d, content, userWords: countWords(content), updatedAt: new Date().toISOString() }
          : d,
      ),
    );
  }, []);

  const setDraftSkeleton = useCallback((draftId: string, skeleton: Skeleton) => {
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, skeleton } : d)));
  }, []);

  const citeFragment = useCallback((draftId: string, fragmentId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId && !d.citedFragmentIds.includes(fragmentId)
          ? { ...d, citedFragmentIds: [...d.citedFragmentIds, fragmentId] }
          : d,
      ),
    );
    setFragments((prev) => prev.map((f) => (f.id === fragmentId ? { ...f, reflowed: true } : f)));
  }, []);

  // 「请求展开」：AI 只给要点，字数计入 aiWords（护栏）
  const expandSkeleton = useCallback((draftId: string, addedAiWords: number) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? { ...d, aiWords: d.aiWords + addedAiWords, expandUses: d.expandUses + 1 }
          : d,
      ),
    );
  }, []);

  const publishDraft = useCallback(
    (draftId: string): Writing | undefined => {
      const draft = drafts.find((d) => d.id === draftId);
      if (!draft) return undefined;
      const writing: Writing = {
        id: `w-${draftId}-${Date.now()}`,
        draftId,
        gapId: draft.gapId,
        title: draft.title,
        content: draft.content,
        userWords: draft.userWords,
        aiWords: draft.aiWords,
        publishedAt: new Date().toISOString(),
        reflowed: true,
      };
      setWritings((prev) => [writing, ...prev]);
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status: "published" } : d)));
      setGaps((prev) => prev.map((g) => (g.id === draft.gapId ? { ...g, status: "published" } : g)));
      // 回流：把引用的碎片标记盘活
      setFragments((prev) =>
        prev.map((f) => (draft.citedFragmentIds.includes(f.id) ? { ...f, reflowed: true } : f)),
      );
      return writing;
    },
    [drafts],
  );

  const setGuardrails = useCallback((g: Partial<Guardrails>) => {
    setGuardrailsState((prev) => ({ ...prev, ...g }));
  }, []);

  const todayInflow = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return fragments.filter((f) => f.createdAt.slice(0, 10) === today).length;
  }, [fragments]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      clusters,
      fragments,
      gaps,
      drafts,
      writings,
      guardrails,
      getGap,
      getDraft,
      getFragment,
      fragmentsForGap,
      ensureDraftForGap,
      setDraftContent,
      setDraftSkeleton,
      citeFragment,
      expandSkeleton,
      publishDraft,
      setGuardrails,
      todayInflow,
    }),
    [ready, clusters, fragments, gaps, drafts, writings, guardrails, getGap, getDraft, getFragment, fragmentsForGap, ensureDraftForGap, setDraftContent, setDraftSkeleton, citeFragment, expandSkeleton, publishDraft, setGuardrails, todayInflow],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useZhizhi(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useZhizhi must be used within ZhizhiProvider");
  return ctx;
}

export { aiRatio, countWords };
