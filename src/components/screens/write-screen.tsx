"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Eye, History, List, Maximize2, Minimize2, PenLine, RotateCcw, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AIQuotaMeter } from "@/components/zhizhi/ai-quota-meter";
import { AuthorshipView } from "@/components/zhizhi/authorship-view";
import { SkeletonPanel } from "@/components/zhizhi/skeleton-panel";
import { SourcePanel } from "@/components/zhizhi/source-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { generateSkeleton, requestExpand } from "@/lib/api/skeleton";
import { presetExpand, presetSkeleton } from "@/lib/zhizhi/skeleton-fallback";
import { extractOutline } from "@/lib/zhizhi/outline";
import { pushSnapshot, snapshotSummary, type Snapshot } from "@/lib/zhizhi/history";
import { useZhizhi } from "@/lib/zhizhi/store";
import { aiRatio, countWords, identityToPromptContext, type Fragment } from "@/lib/zhizhi/types";

export function WriteScreen({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    ready,
    getDraft,
    fragmentsForGap,
    guardrails,
    identity,
    setDraftContent,
    setDraftSkeleton,
    citeFragment,
    unciteFragment,
    expandSkeleton,
    publishDraft,
    llmConfig,
  } = useZhizhi();

  const draft = getDraft(draftId);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});
  // 画布视图：edit=可编辑 textarea；author=只读 Authorship 可视化（区分你写的 vs 引用的）
  const [canvasView, setCanvasView] = useState<"edit" | "author">("edit");
  // 专注模式：隐藏骨架/素材栏与多余 chrome，只留正文，居中放大、背景变暗。
  const [focusMode, setFocusMode] = useState(false);

  // 专注模式下按 Esc 退出
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const fragments = useMemo(() => (draft ? fragmentsForGap(draft.gapId) : []), [draft, fragmentsForGap]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 从正文的 markdown 标题提取大纲（点击可在编辑区定位到该标题行）
  const outline = useMemo(() => extractOutline(draft?.content ?? ""), [draft?.content]);

  // 把编辑区光标/滚动定位到大纲某标题所在行
  function jumpToLine(line: number) {
    const ta = textareaRef.current;
    const content = draft?.content ?? "";
    if (!ta) return;
    setCanvasView("edit");
    const pos = content.split("\n").slice(0, line).reduce((n, l) => n + l.length + 1, 0);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
      // 估算滚动位置：按行高粗略定位
      const lineHeight = 32;
      ta.scrollTop = Math.max(0, line * lineHeight - ta.clientHeight / 3);
    });
  }

  // 版本历史：按 draftId 存本地快照（不进共享 DB）。写作时防抖追加，可回看/恢复。
  const HISTORY_KEY = `zhizhi-history-${draftId}`;
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // 挂载时从本地读历史（用 microtask 延后 setState，规避「effect 内同步 setState」级联渲染告警）
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        if (raw) setHistory(JSON.parse(raw) as Snapshot[]);
      } catch {
        /* 忽略损坏的本地历史 */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [HISTORY_KEY]);

  // 正文变化时防抖存快照（内容非空、有变化、间隔足够才真正增条）
  const draftContent = draft?.content ?? "";
  useEffect(() => {
    if (!draftContent.trim()) return;
    const timer = setTimeout(() => {
      setHistory((prev) => {
        const next = pushSnapshot(prev, draftContent, new Date());
        if (next === prev) return prev;
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          /* 本地存储不可用时静默失败 */
        }
        return next;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [draftContent, HISTORY_KEY]);

  if (!ready) {
    return <div className="px-6 py-10 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!draft) {
    return (
      <div className="px-6 py-10">
        <p className="text-sm text-muted-foreground">{t("errors.notFound.title")}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/gaps")}>
          {t("errors.notFound.backHome")}
        </Button>
      </div>
    );
  }

  const ratio = aiRatio(draft.userWords, draft.aiWords);
  const over = ratio > guardrails.aiRatioLimit;

  async function onGenerate() {
    if (!draft) return;
    setGenerating(true);
    try {
      const skeleton = await generateSkeleton({
        gapTitle: draft.title,
        fragments: fragments.map((f) => f.content),
        identity: identityToPromptContext(identity),
      }, llmConfig);
      setDraftSkeleton(draft.id, skeleton);
    } catch {
      setDraftSkeleton(draft.id, presetSkeleton(draft.title, fragments.map((f) => f.content)));
      toast.info(t("write.genFailed"));
    } finally {
      setGenerating(false);
    }
  }

  async function onExpand(heading: string) {
    if (!draft) return;
    if (draft.expandUses >= guardrails.expandLimit) {
      toast.warning(t("write.expandDisabled"));
      return;
    }
    let bullets: string[];
    try {
      bullets = await requestExpand({
        gapTitle: draft.title,
        heading,
        fragments: fragments.map((f) => f.content),
      }, llmConfig);
    } catch {
      bullets = presetExpand(heading);
    }
    setExpanded((prev) => ({ ...prev, [heading]: [...(prev[heading] ?? []), ...bullets] }));
    expandSkeleton(draft.id, bullets.reduce((s, b) => s + countWords(b), 0));
  }

  function onInsert(f: Fragment) {
    if (!draft) return;
    setDraftContent(draft.id, draft.content + `\n\n> ${f.content}\n\n`);
    citeFragment(draft.id, f.id);
  }

  // 撤回：从正文删掉该片段的引用块，并移除引用标记
  function onRemove(f: Fragment) {
    if (!draft) return;
    const block = `\n\n> ${f.content}\n\n`;
    const idx = draft.content.indexOf(block);
    if (idx >= 0) {
      setDraftContent(draft.id, draft.content.slice(0, idx) + draft.content.slice(idx + block.length));
    }
    unciteFragment(draft.id, f.id);
  }

  function onPublish() {
    if (!draft) return;
    publishDraft(draft.id);
    toast.success(t("write.published"));
    router.push("/library");
  }

  const skeletonNode = (
    <SkeletonPanel
      skeleton={draft.skeleton}
      generating={generating}
      onGenerate={onGenerate}
      onExpand={onExpand}
      expandUses={draft.expandUses}
      expandLimit={guardrails.expandLimit}
      expanded={expanded}
    />
  );
  const sourceNode = <SourcePanel fragments={fragments} citedIds={draft.citedFragmentIds} onInsert={onInsert} onRemove={onRemove} />;
  const canvasNode = (
    <div data-el="write-canvas" className="flex h-full flex-col rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("write.canvasTitle")}
        </span>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-accent" data-el="your-words">
            {t("write.yourWords")} {draft.userWords}
          </span>
          <span className="text-muted-foreground" data-el="ai-words">
            {t("write.aiWords")} {draft.aiWords}
          </span>
          <button
            data-el="canvas-view-toggle"
            onClick={() => setCanvasView((v) => (v === "edit" ? "author" : "edit"))}
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 font-medium text-foreground/80 transition-colors hover:border-accent/50 hover:text-accent"
            title={canvasView === "edit" ? t("write.authorView") : t("write.editView")}
          >
            {canvasView === "edit" ? (
              <><Eye className="h-3 w-3" aria-hidden /> {t("write.authorView")}</>
            ) : (
              <><PenLine className="h-3 w-3" aria-hidden /> {t("write.editView")}</>
            )}
          </button>
        </div>
      </div>
      {over && (
        <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {t("write.overWarn", {
            ratio: Math.round(ratio * 100),
            limit: Math.round(guardrails.aiRatioLimit * 100),
          })}
        </div>
      )}
      {canvasView === "edit" && outline.length > 0 && (
        <div data-el="write-outline" className="mb-2 rounded-lg border border-border bg-background/60 px-3 py-2">
          <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <List className="h-3 w-3" aria-hidden /> {t("write.outline")}
          </div>
          <ul className="space-y-0.5">
            {outline.map((o, i) => (
              <li key={i}>
                <button
                  data-el="write-outline-item"
                  onClick={() => jumpToLine(o.line)}
                  style={{ paddingLeft: `${(o.level - 1) * 12}px` }}
                  className="block w-full truncate text-left text-xs text-foreground/70 transition-colors hover:text-accent"
                >
                  {o.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canvasView === "edit" ? (
        <Textarea
          ref={textareaRef}
          data-el="write-textarea"
          value={draft.content}
          onChange={(e) => setDraftContent(draft.id, e.target.value)}
          placeholder={t("write.canvasPlaceholder")}
          className="zz-serif min-h-[280px] flex-1 resize-none border-0 bg-transparent text-[15px] leading-8 shadow-none focus-visible:ring-0 md:min-h-[420px]"
        />
      ) : (
        <div className="min-h-[280px] flex-1 md:min-h-[420px]">
          <AuthorshipView content={draft.content} />
        </div>
      )}
    </div>
  );

  return (
    <div data-el="write" className={`flex min-h-full flex-col ${focusMode ? "bg-background" : ""}`}>
      <div className="flex items-center gap-3 border-b border-border bg-card/60 px-4 py-2.5 md:px-6">
        <button
          data-el="write-back"
          onClick={() => router.push("/gaps")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("write.back")}
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {t("write.draft")}：{draft.title}
        </span>
        <button
          data-el="focus-toggle"
          onClick={() => setFocusMode((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-accent/50 hover:text-accent"
          title={focusMode ? t("write.exitFocus") : t("write.focus")}
        >
          {focusMode ? (
            <><Minimize2 className="h-3.5 w-3.5" aria-hidden /> {t("write.exitFocus")}</>
          ) : (
            <><Maximize2 className="h-3.5 w-3.5" aria-hidden /> {t("write.focus")}</>
          )}
        </button>
        <button
          data-el="history-toggle"
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-accent/50 hover:text-accent"
          title={t("write.history")}
        >
          <History className="h-3.5 w-3.5" aria-hidden /> {t("write.history")}
        </button>
        <AIQuotaMeter ratio={ratio} limit={guardrails.aiRatioLimit} compact />
      </div>

      {focusMode ? (
        // 专注模式：仅画布，居中限宽，Esc/按钮退出
        <div data-el="write-focus" className="flex-1 px-4 py-6 md:py-10">
          <div className="mx-auto w-full max-w-3xl">
            {canvasNode}
            <p className="mt-3 text-center text-[11px] text-muted-foreground">{t("write.focusHint")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden flex-1 gap-4 px-6 py-5 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]">
            {skeletonNode}
            {canvasNode}
            {sourceNode}
          </div>

          <div className="flex-1 px-4 py-4 lg:hidden">
            <Tabs defaultValue="canvas" className="h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="skeleton" data-el="tab-skeleton">
                  {t("write.skeletonTitle")}
                </TabsTrigger>
                <TabsTrigger value="canvas" data-el="tab-canvas">
                  {t("write.canvasTitle")}
                </TabsTrigger>
                <TabsTrigger value="source" data-el="tab-source">
                  {t("write.sourceTitle")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="skeleton" className="mt-3">{skeletonNode}</TabsContent>
              <TabsContent value="canvas" className="mt-3">{canvasNode}</TabsContent>
              <TabsContent value="source" className="mt-3">{sourceNode}</TabsContent>
            </Tabs>
          </div>
        </>
      )}

      <div
        data-el="reflow-bar"
        className="sticky bottom-0 z-20 flex items-center justify-end gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:px-6"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
      >
        <span className="mr-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-accent" /> {t("write.saved")}
        </span>
        <Button data-el="write-publish" onClick={onPublish} className="gap-1.5">
          <Send className="h-4 w-4" /> {t("write.publish")}
        </Button>
      </div>

      {/* 版本历史面板 */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="inline-flex items-center gap-1.5">
              <History className="h-4 w-4 text-accent" /> {t("write.history")}
            </SheetTitle>
          </SheetHeader>
          {history.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">{t("write.historyEmpty")}</p>
          ) : (
            <ul className="space-y-2 px-4 pb-6">
              {history.map((snap, i) => {
                const { firstLine, chars } = snapshotSummary(snap);
                const isCurrent = snap.content === draft.content;
                return (
                  <li
                    key={snap.at + i}
                    data-el="history-item"
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{new Date(snap.at).toLocaleString()}</span>
                      <span>{t("write.historyChars", { count: chars })}</span>
                    </div>
                    <p className="zz-serif mt-1 line-clamp-2 text-sm text-foreground/80">{firstLine}</p>
                    {isCurrent ? (
                      <span className="mt-2 inline-block rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
                        {t("write.historyCurrent")}
                      </span>
                    ) : (
                      <button
                        data-el="history-restore"
                        onClick={() => {
                          setDraftContent(draft.id, snap.content);
                          setHistoryOpen(false);
                          setCanvasView("edit");
                          toast.success(t("write.historyRestored"));
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> {t("write.historyRestore")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
