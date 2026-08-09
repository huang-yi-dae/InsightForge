"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/zhizhi/app-shell";
import { Button } from "@/components/ui/button";
import { useZhizhi } from "@/lib/zhizhi/store";
import { cn } from "@/utils/utils";

function GapsInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { gaps, clusters, fragmentsForGap, ensureDraftForGap } = useZhizhi();
  const activeGaps = gaps.filter((g) => g.status !== "published");
  const [selectedId, setSelectedId] = useState<string | null>(activeGaps[0]?.id ?? null);

  const selected = useMemo(() => gaps.find((g) => g.id === selectedId) ?? null, [gaps, selectedId]);
  const selectedFragments = selected ? fragmentsForGap(selected.id) : [];

  function proceed(gapId: string) {
    const draftId = ensureDraftForGap(gapId);
    router.push(`/write/${draftId}`);
  }

  return (
    <div data-el="gaps" className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="zz-serif text-2xl font-bold text-foreground md:text-3xl">{t("gaps.title")}</h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t("gaps.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" data-el="gaps-recon" className="shrink-0 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> {t("gaps.recon")}
        </Button>
      </div>

      {activeGaps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          {t("gaps.empty")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
          {/* 左联：碎片场（工程测绘网格上的剪影分布） */}
          <div
            data-el="gaps-fragment-field"
            className="zz-grid-underlay relative min-h-52 overflow-hidden rounded-xl border border-border bg-card/40 p-4"
          >
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("gaps.leftTitle")}
            </div>
            <div className="relative h-full">
              {clusters.map((c, i) => {
                const inSelected = selected?.clusterIds.includes(c.id);
                const pos = [
                  { top: "6%", left: "8%" },
                  { top: "20%", left: "58%" },
                  { top: "58%", left: "18%" },
                  { top: "62%", left: "62%" },
                ][i % 4];
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "absolute max-w-[46%] rounded-lg border px-2.5 py-1.5 text-[11px] leading-tight shadow-sm transition-all",
                      inSelected
                        ? "border-accent bg-accent/12 text-accent"
                        : "border-border bg-card text-foreground/70",
                    )}
                    style={pos}
                  >
                    <span className="line-clamp-2">{c.label}</span>
                    <span className="mt-0.5 block text-[10px] opacity-60">{c.fragmentIds.length} {t("gaps.fragmentUnit")}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 中联：空白列表 */}
          <div data-el="gaps-list" className="space-y-2.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("gaps.listTitle")}
            </div>
            {activeGaps.map((gap) => (
              <button
                key={gap.id}
                data-el="gap-list-item"
                onClick={() => setSelectedId(gap.id)}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all",
                  selectedId === gap.id
                    ? "border-accent bg-accent/8 shadow-md"
                    : "border-border bg-card hover:border-accent/40",
                )}
              >
                <span className="font-medium text-foreground">{gap.title}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {t("gaps.confidence")} {gap.confidence.toFixed(2)}
                  </span>
                  <span>
                    {gap.supportingFragmentIds.length} {t("gaps.supporting")}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* 右联：详情 */}
          <div
            data-el="gaps-detail"
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("gaps.detailTitle")}
            </div>
            {selected ? (
              <div className="mt-3 space-y-4">
                <h3 className="zz-serif text-lg font-semibold leading-snug text-foreground">
                  {selected.title}
                </h3>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t("gaps.adjacentConcepts")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.clusterIds.map((cid) => (
                      <span
                        key={cid}
                        className="rounded-full border border-accent/30 bg-accent/8 px-2.5 py-0.5 text-xs text-accent"
                      >
                        {clusters.find((c) => c.id === cid)?.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t("gaps.fragmentPreview")}
                  </div>
                  <div className="space-y-2">
                    {selectedFragments.slice(0, 4).map((f) => (
                      <div
                        key={f.id}
                        className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs leading-relaxed text-foreground/80"
                      >
                        {f.content}
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  data-el="gaps-generate-skeleton"
                  onClick={() => proceed(selected.id)}
                  className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {selected.status === "drafting" ? t("gaps.resume") : t("gaps.generateSkeleton")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("gaps.pickHint")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GapsPage() {
  return (
    <AppShell>
      <GapsInner />
    </AppShell>
  );
}
