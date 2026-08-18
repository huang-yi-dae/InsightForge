"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GUARDRAILS,
  DEFAULT_IDENTITY,
  aiRatio,
  countWords,
  type Cluster,
  type Draft,
  type Fragment,
  type FragmentSource,
  type Gap,
  type Guardrails,
  type Identity,
  type Skeleton,
  type Writing,
  identityToPromptContext,
} from "./types";
import { SEED_CLUSTERS, SEED_DRAFTS, SEED_FRAGMENTS, SEED_GAPS, SEED_WRITINGS } from "./sample-library";
import type { KbState } from "@/lib/api/kb";
import { createKbRepository, readLocalState } from "@/lib/data/kb-repository";
import {
  discoverGaps as runDiscovery,
  splitIntoFragments,
  toGap,
  bestClusterFor,
  dedupeSetsFromGaps,
  DISCOVERY,
  type AiIdea,
} from "./discovery";
import { UNCATEGORIZED_CLUSTER_ID, UNCATEGORIZED_LABEL_SENTINEL } from "./cluster-label";
import { EMPTY_LLM_CONFIG, hasLLMConfig, type LLMConfig } from "@/lib/llm/config";
import { discoverIdeasDirect } from "@/lib/llm/discover";
import { LLMError, type LLMErrorKind } from "@/lib/llm/client";

// LLM 配置单独存本地（含 API Key）：绝不写入共享 DB payload，只留在本机 localStorage。
const LLM_CONFIG_KEY = "zhizhi-llm-config-v1";

interface PersistShape {
  clusters?: Cluster[];
  drafts: Draft[];
  writings: Writing[];
  gaps: Gap[];
  fragments: Fragment[];
  guardrails: Guardrails;
  identity?: Identity;
}

interface StoreValue {
  ready: boolean;
  clusters: Cluster[];
  fragments: Fragment[];
  gaps: Gap[];
  drafts: Draft[];
  writings: Writing[];
  guardrails: Guardrails;
  identity: Identity;
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
  // 撤回引用：把碎片从草稿引用列表移除
  unciteFragment: (draftId: string, fragmentId: string) => void;
  // 给某个 gap 增删引用碎片（文章详情页管理引用用）
  toggleGapFragment: (gapId: string, fragmentId: string) => void;
  expandSkeleton: (draftId: string, addedAiWords: number) => void;
  publishDraft: (draftId: string) => Writing | undefined;
  setGuardrails: (g: Partial<Guardrails>) => void;
  setIdentity: (id: Partial<Identity>) => void;
  // LLM 运行时配置（BYOK）：用户自选供应商 + Key + 模型。仅存本地。
  llmConfig: LLMConfig;
  setLLMConfig: (c: LLMConfig) => void;
  // 快速采集：随手存一条碎片，自动归到最匹配的簇
  captureFragment: (content: string, source?: FragmentSource) => void;
  // 存量内容导入：把一段长文本（日记/摘抄/旧文）切成碎片入库，返回入库条数
  importContent: (text: string, source?: FragmentSource) => number;
  // 从存量内容发现「可写的点」，追加为新的 gap，返回新增数量
  discoverNewGaps: (limit?: number) => number;
  // AI 优先发现：调用 /api/discover；无 Key/失败时回退本地启发式。
  // 返回 { added: 新增数量, usedAi: 是否真的用到了 AI, reason?: 直连失败分类 }
  discoverNewGapsAI: (
    limit?: number,
  ) => Promise<{ added: number; usedAi: boolean; reason?: LLMErrorKind }>;
  todayInflow: number;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadPersist(): PersistShape | null {
  // 本地预水合复用统一数据层的读取实现，保证与 desktop 后端读同一份数据。
  return readLocalState(typeof window !== "undefined" ? window.localStorage : null);
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
  const [identity, setIdentityState] = useState<Identity>(DEFAULT_IDENTITY);
  const [clusters, setClusters] = useState<Cluster[]>(SEED_CLUSTERS);
  // BYOK LLM 配置：SSR 一律用空配置，客户端 useEffect 里从 localStorage 读，避免 hydration 不一致。
  const [llmConfig, setLLMConfigState] = useState<LLMConfig>(EMPTY_LLM_CONFIG);
  const [ready, setReady] = useState<boolean>(false);
  const hydrated = useRef(false);
  // 持久化后端：加载完成前为 null；远程(REST /api)可用 → "remote"，否则 → "local"。
  const backend = useRef<"remote" | "local" | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 统一数据层：上层只依赖它，内部按环境选择 fetch /api 或 localStorage。
  const repo = useMemo(() => createKbRepository(), []);

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
        if (local.identity) setIdentityState({ ...DEFAULT_IDENTITY, ...local.identity });
      }

      // 1b) LLM 配置（含 Key）永远只从本地读，绝不来自 DB。
      try {
        const rawLlm = window.localStorage.getItem(LLM_CONFIG_KEY);
        if (rawLlm) {
          const parsed = JSON.parse(rawLlm) as Partial<LLMConfig>;
          setLLMConfigState({ ...EMPTY_LLM_CONFIG, ...parsed });
        }
      } catch {
        /* 忽略损坏的本地配置 */
      }

      // 2) 经统一数据层加载权威状态（网页端走 REST /api，桌面端走本地）
      const { source, state: s } = await repo.load();
      if (cancelled) return;
      if (s) {
        setClusters(s.clusters);
        setFragments(s.fragments);
        setGaps(s.gaps);
        setDrafts(s.drafts);
        setWritings(s.writings);
        setGuardrailsState({ ...DEFAULT_GUARDRAILS, ...s.guardrails });
        if (s.identity) setIdentityState({ ...DEFAULT_IDENTITY, ...s.identity });
      }
      backend.current = source;
      hydrated.current = true;
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [repo]);

  // 持久化：DB 模式防抖 PUT，本地模式写 localStorage。
  useEffect(() => {
    if (!hydrated.current || !backend.current) return;
    const snapshot: KbState = { clusters, fragments, gaps, drafts, writings, guardrails, identity };
    if (backend.current === "remote") {
      // 远程(REST)：防抖 PUT，避免频繁写库。
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void repo.save(snapshot);
      }, 600);
    } else {
      // 本地：写便宜，直接经统一数据层落 localStorage。
      void repo.save(snapshot);
    }
  }, [clusters, drafts, writings, gaps, fragments, guardrails, identity, repo]);

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

  const unciteFragment = useCallback((draftId: string, fragmentId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? { ...d, citedFragmentIds: d.citedFragmentIds.filter((id) => id !== fragmentId) }
          : d,
      ),
    );
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

  // 给某个 gap 增删引用碎片（详情页「引用管理」用）。已在则移除，不在则加入。
  const toggleGapFragment = useCallback((gapId: string, fragmentId: string) => {
    setGaps((prev) =>
      prev.map((g) => {
        if (g.id !== gapId) return g;
        const has = g.supportingFragmentIds.includes(fragmentId);
        return {
          ...g,
          supportingFragmentIds: has
            ? g.supportingFragmentIds.filter((id) => id !== fragmentId)
            : [...g.supportingFragmentIds, fragmentId],
        };
      }),
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
      const nextWritings = [writing, ...writings];
      const nextDrafts = drafts.map((d) => (d.id === draftId ? { ...d, status: "published" as const } : d));
      const nextGaps = gaps.map((g) => (g.id === draft.gapId ? { ...g, status: "published" as const } : g));
      const nextFragments = fragments.map((f) =>
        draft.citedFragmentIds.includes(f.id) ? { ...f, reflowed: true } : f,
      );
      setWritings(nextWritings);
      setDrafts(nextDrafts);
      setGaps(nextGaps);
      // 回流：把引用的碎片标记盘活
      setFragments(nextFragments);
      // 即时落库（远程模式）：不等 600ms 防抖，避免"发布后立刻跳转/刷新"时新文章还没写进库。
      if (backend.current === "remote") {
        void repo.save({
          clusters,
          fragments: nextFragments,
          gaps: nextGaps,
          drafts: nextDrafts,
          writings: nextWritings,
          guardrails,
          identity,
        });
      }
      return writing;
    },
    [drafts, writings, gaps, fragments, clusters, guardrails, identity, repo],
  );

  const setGuardrails = useCallback((g: Partial<Guardrails>) => {
    setGuardrailsState((prev) => ({ ...prev, ...g }));
  }, []);

  const setIdentity = useCallback((id: Partial<Identity>) => {
    setIdentityState((prev) => ({ ...prev, ...id }));
  }, []);

  // 保存 LLM 配置：立即写入本地 localStorage（含 Key，只留本机）。
  const setLLMConfig = useCallback((c: LLMConfig) => {
    setLLMConfigState(c);
    try {
      window.localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(c));
    } catch {
      /* 本地存储不可用时静默失败，配置仍在内存中生效 */
    }
  }, []);

  // 快速采集：把一条随手记的碎片归到「标题与内容重合度最高」的簇；
  // 无匹配则落到第一个簇。同时把碎片挂到该簇，喂养后续空白勘探。
  const captureFragment = useCallback(
    (content: string, source: FragmentSource = "raw") => {
      const text = content.trim();
      if (!text) return;
      const target = bestClusterFor(text, clusters) ?? clusters[0];
      if (!target) return;
      const id = `f-${Date.now()}`;
      const frag: Fragment = {
        id,
        clusterId: target.id,
        source,
        content: text,
        createdAt: new Date().toISOString(),
        reflowed: false,
      };
      setFragments((prev) => [frag, ...prev]);
      setClusters((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, fragmentIds: [id, ...c.fragmentIds] } : c)),
      );
    },
    [clusters],
  );

  // 存量内容导入：把长文本切成碎片，逐条归到最匹配的簇；
  // 完全无匹配的落到「未归类」簇（不存在则创建）。返回入库条数。
  const importContent = useCallback(
    (text: string, source: FragmentSource = "para") => {
      const lines = splitIntoFragments(text);
      if (lines.length === 0) return 0;

      const now = Date.now();
      const newFrags: Fragment[] = [];
      // 复制一份可变簇结构用于批量归类
      const clusterMap = new Map(clusters.map((c) => [c.id, { ...c, fragmentIds: [...c.fragmentIds] }]));
      let uncategorized = clusterMap.get(UNCATEGORIZED_CLUSTER_ID);
      const matchable = () =>
        [...clusterMap.values()].filter((c) => c.id !== UNCATEGORIZED_CLUSTER_ID);

      lines.forEach((line, idx) => {
        let target = bestClusterFor(line, matchable());
        if (!target) {
          if (!uncategorized) {
            // 存哨兵 label，展示层用 clusterLabel() 翻译，避免硬编码中文（P1）
            uncategorized = {
              id: UNCATEGORIZED_CLUSTER_ID,
              label: UNCATEGORIZED_LABEL_SENTINEL,
              fragmentIds: [],
            };
            clusterMap.set(UNCATEGORIZED_CLUSTER_ID, uncategorized);
          }
          target = uncategorized;
        }
        const id = `f-${now}-${idx}`;
        newFrags.push({
          id,
          clusterId: target.id,
          source,
          content: line,
          createdAt: new Date().toISOString(),
          reflowed: false,
        });
        target.fragmentIds.unshift(id);
      });

      setFragments((prev) => [...newFrags, ...prev]);
      setClusters(() => [...clusterMap.values()]);
      return newFrags.length;
    },
    [clusters],
  );

  // 从存量内容发现「可写的点」，去重后追加为新的 todo gap。返回新增数量。
  const discoverNewGaps = useCallback(
    (limit: number = DISCOVERY.DEFAULT_LIMIT) => {
      const found = runDiscovery(clusters, fragments, gaps, limit);
      if (found.length === 0) return 0;
      const newGaps = found.map(toGap);
      setGaps((prev) => [...newGaps, ...prev]);
      return newGaps.length;
    },
    [clusters, fragments, gaps],
  );

  // AI 优先发现：把每个簇的标题+少量碎片摘录发给 /api/discover，
  // AI 归纳主题并给出可写选题；无 Key / 失败 / 空结果时回退本地启发式。
  const discoverNewGapsAI = useCallback(
    async (
      limit: number = DISCOVERY.DEFAULT_LIMIT,
    ): Promise<{ added: number; usedAi: boolean; reason?: LLMErrorKind }> => {
      const payloadClusters = clusters
        .map((c) => {
          const frags = fragments
            .filter((f) => f.clusterId === c.id)
            .slice(0, DISCOVERY.MAX_SUPPORTING_FRAGMENTS)
            .map((f) => f.content);
          return { id: c.id, label: c.label, fragments: frags };
        })
        .filter((c) => c.fragments.length > 0);

      // 没有任何素材时，本地启发式也无从发现
      if (payloadClusters.length === 0) return { added: 0, usedAi: false };

      const fallback = () => ({ added: discoverNewGaps(limit), usedAi: false });

      try {
        const controller = new AbortController();
        // 实测 AI 单次可达约 20s，超时留足余量避免"白等一场"后仍回退本地（P0）
        const timer = setTimeout(() => controller.abort(), DISCOVERY.AI_TIMEOUT_MS);

        // 服务端代转：把 clusters（可选带上 llm 配置）发给 /api/discover。
        const viaRoute = async (withKey: boolean): Promise<AiIdea[]> => {
          const res = await fetch("/api/discover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              limit,
              identity: identityToPromptContext(identity),
              clusters: payloadClusters,
              ...(withKey && hasLLMConfig(llmConfig) ? { llm: llmConfig } : {}),
            }),
            signal: controller.signal,
          });
          if (!res.ok) throw new LLMError(res.status === 401 || res.status === 403 ? "auth" : "http", `route ${res.status}`, res.status);
          const data = (await res.json().catch(() => null)) as { ideas?: AiIdea[] } | null;
          return data?.ideas ?? [];
        };

        let ideas: AiIdea[];
        if (hasLLMConfig(llmConfig)) {
          // 主路径：用用户本地 BYOK 配置浏览器直连（与桌面端同一套逻辑）。
          try {
            ideas = await discoverIdeasDirect(
              llmConfig,
              payloadClusters,
              limit,
              identityToPromptContext(identity),
              controller.signal,
            );
          } catch (e) {
            // 被 CORS/网络拦截（如 OpenAI 不允许浏览器直连）→ 自动带 key 改走服务端代转。
            if (e instanceof LLMError && (e.kind === "cors" || e.kind === "http")) {
              ideas = await viaRoute(true);
            } else {
              throw e; // auth/timeout：代转也解决不了，交给外层分类
            }
          }
        } else {
          // 本地没配置：尝试服务端环境变量（若部署方配了）。
          ideas = await viaRoute(false);
        }
        clearTimeout(timer);

        if (ideas.length === 0) return fallback();

        // 去重：跳过标题已存在、或该簇已有活跃 gap 的（共享 dedupeSetsFromGaps）
        const { titles: existingTitles, coveredClusterIds: coveredClusters } =
          dedupeSetsFromGaps(gaps);

        const newGaps: Gap[] = [];
        for (const idea of ideas) {
          if (existingTitles.has(idea.title)) continue;
          if (coveredClusters.has(idea.clusterId)) continue;
          const supporting = fragments
            .filter((f) => f.clusterId === idea.clusterId)
            .slice(0, DISCOVERY.MAX_SUPPORTING_FRAGMENTS)
            .map((f) => f.id);
          if (supporting.length === 0) continue;
          existingTitles.add(idea.title);
          coveredClusters.add(idea.clusterId);
          newGaps.push({
            id: `gap-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: idea.title,
            confidence: idea.confidence,
            clusterIds: [idea.clusterId],
            supportingFragmentIds: supporting,
            status: "todo",
            aiReason: idea.reason || undefined,
          });
        }

        // AI 全部被去重掉：也回退本地，尽量给用户一点新东西
        if (newGaps.length === 0) return fallback();

        setGaps((prev) => [...newGaps, ...prev]);
        return { added: newGaps.length, usedAi: true };
      } catch (e) {
        // 用户配了 BYOK 却直连失败：回退本地，但把失败原因透出，让 UI 给可行动提示。
        if (hasLLMConfig(llmConfig) && e instanceof LLMError) {
          return { ...fallback(), reason: e.kind };
        }
        return fallback();
      }
    },
    [clusters, fragments, gaps, identity, discoverNewGaps, llmConfig],
  );

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
      identity,
      getGap,
      getDraft,
      getFragment,
      fragmentsForGap,
      ensureDraftForGap,
      setDraftContent,
      setDraftSkeleton,
      citeFragment,
      unciteFragment,
      toggleGapFragment,
      expandSkeleton,
      publishDraft,
      setGuardrails,
      setIdentity,
      llmConfig,
      setLLMConfig,
      captureFragment,
      importContent,
      discoverNewGaps,
      discoverNewGapsAI,
      todayInflow,
    }),
    [ready, clusters, fragments, gaps, drafts, writings, guardrails, identity, getGap, getDraft, getFragment, fragmentsForGap, ensureDraftForGap, setDraftContent, setDraftSkeleton, citeFragment, unciteFragment, toggleGapFragment, expandSkeleton, publishDraft, setGuardrails, setIdentity, llmConfig, setLLMConfig, captureFragment, importContent, discoverNewGaps, discoverNewGapsAI, todayInflow],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useZhizhi(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useZhizhi must be used within ZhizhiProvider");
  return ctx;
}

export { aiRatio, countWords };
