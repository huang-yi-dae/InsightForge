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
import { MOCK_CLUSTERS, MOCK_DRAFTS, MOCK_FRAGMENTS, MOCK_GAPS, MOCK_WRITINGS } from "./mock";

const STORAGE_KEY = "zhizhi-state-v1";

interface PersistShape {
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
  // 懒初始化：仅执行一次。在浏览器端直接从 localStorage 读取，
  // 避免在 effect 里 setState 造成级联渲染，也避免在渲染期访问 ref。
  const [fragments, setFragments] = useState<Fragment[]>(() => {
    const p = loadPersist();
    return p?.fragments?.length ? p.fragments : MOCK_FRAGMENTS;
  });
  const [gaps, setGaps] = useState<Gap[]>(() => {
    const p = loadPersist();
    return p?.gaps?.length ? p.gaps : MOCK_GAPS;
  });
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    const p = loadPersist();
    return p?.drafts?.length ? p.drafts : MOCK_DRAFTS;
  });
  const [writings, setWritings] = useState<Writing[]>(() => {
    const p = loadPersist();
    return p?.writings?.length ? p.writings : MOCK_WRITINGS;
  });
  const [guardrails, setGuardrailsState] = useState<Guardrails>(() => ({
    ...DEFAULT_GUARDRAILS,
    ...loadPersist()?.guardrails,
  }));
  const [ready] = useState<boolean>(() => typeof window !== "undefined");
  const clusters = MOCK_CLUSTERS;
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const payload: PersistShape = { drafts, writings, gaps, fragments, guardrails };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }, [drafts, writings, gaps, fragments, guardrails]);

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
