"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AIQuotaMeter } from "@/components/zhizhi/ai-quota-meter";
import { SkeletonPanel } from "@/components/zhizhi/skeleton-panel";
import { SourcePanel } from "@/components/zhizhi/source-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateSkeleton, requestExpand } from "@/lib/api/skeleton";
import { presetExpand, presetSkeleton } from "@/lib/zhizhi/skeleton-fallback";
import { useZhizhi } from "@/lib/zhizhi/store";
import { aiRatio, countWords, type Fragment } from "@/lib/zhizhi/types";

export function WriteScreen({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    ready,
    getDraft,
    fragmentsForGap,
    guardrails,
    setDraftContent,
    setDraftSkeleton,
    citeFragment,
    expandSkeleton,
    publishDraft,
  } = useZhizhi();

  const draft = getDraft(draftId);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});

  const fragments = useMemo(() => (draft ? fragmentsForGap(draft.gapId) : []), [draft, fragmentsForGap]);

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
      });
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
      });
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
  const sourceNode = <SourcePanel fragments={fragments} citedIds={draft.citedFragmentIds} onInsert={onInsert} />;
  const canvasNode = (
    <div data-el="write-canvas" className="flex h-full flex-col rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("write.canvasTitle")}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-medium text-accent" data-el="your-words">
            {t("write.yourWords")} {draft.userWords}
          </span>
          <span className="text-muted-foreground" data-el="ai-words">
            {t("write.aiWords")} {draft.aiWords}
          </span>
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
      <Textarea
        data-el="write-textarea"
        value={draft.content}
        onChange={(e) => setDraftContent(draft.id, e.target.value)}
        placeholder={t("write.canvasPlaceholder")}
        className="zz-serif min-h-[280px] flex-1 resize-none border-0 bg-transparent text-[15px] leading-8 shadow-none focus-visible:ring-0 md:min-h-[420px]"
      />
    </div>
  );

  return (
    <div data-el="write" className="flex min-h-full flex-col">
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
        <AIQuotaMeter ratio={ratio} limit={guardrails.aiRatioLimit} compact />
      </div>

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
    </div>
  );
}
