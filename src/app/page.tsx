"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Layers, PenLine, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/zhizhi/app-shell";
import { useZhizhi } from "@/lib/zhizhi/store";
import { clusterLabel } from "@/lib/zhizhi/cluster-label";
import { computeWritingStreak } from "@/lib/zhizhi/streak";
import { MetricsCard } from "@/components/zhizhi/metrics-card";
import { gapReason } from "@/lib/zhizhi/types";

function DashboardInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { gaps, todayInflow, guardrails, ensureDraftForGap, clusters, fragments, writings } = useZhizhi();

  const pendingGaps = gaps.filter((g) => g.status === "todo");
  const draftingGaps = gaps.filter((g) => g.status === "drafting");
  const recommend = [...pendingGaps].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const inflowWarn = todayInflow >= guardrails.dailyInflowLimit;
  // 写作连续天数：从已发布成文的发布日期算（正向激励，奖励真正写完的人）
  const streak = computeWritingStreak(writings.map((w) => w.publishedAt));

  const stats = [
    { key: "inflow", value: todayInflow, icon: Layers, tone: "primary", href: "/gaps" },
    { key: "pendingGaps", value: pendingGaps.length, icon: Sparkles, tone: "accent", href: "/gaps" },
    { key: "drafting", value: draftingGaps.length, icon: PenLine, tone: "primary", href: "/library" },
  ] as const;

  function writeGap(gapId: string) {
    const id = ensureDraftForGap(gapId);
    router.push(`/write/${id}`);
  }

  return (
    <div data-el="dashboard" className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="zz-grid-underlay rounded-2xl border border-border bg-card/50 p-5 md:p-7">
        <h1 className="zz-serif text-2xl font-bold text-foreground md:text-3xl">{t("dashboard.title")}</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {inflowWarn && (
        <div
          data-el="inflow-warn"
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
        >
          {t("dashboard.inflowWarn")}
        </div>
      )}

      {/* 写作连续天数激励卡：用产出倒逼输入，正向驱动 */}
      <button
        data-el="streak-card"
        onClick={() => router.push(streak.current > 0 ? "/library" : "/gaps")}
        className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-accent/50 hover:shadow-md"
      >
        <span
          className={
            streak.current > 0
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          }
        >
          <Flame className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground">
            {streak.current > 0 ? t("dashboard.streakActive", { days: streak.current }) : t("dashboard.streakZero")}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {streak.current === 0
              ? t("dashboard.streakStart")
              : streak.publishedToday
                ? t("dashboard.streakToday")
                : t("dashboard.streakKeep")}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {/* 写作度量：近 7 日字数柱状 + 成就徽章 */}
      <MetricsCard writings={writings} />

      <div className="mt-5 grid grid-cols-3 gap-3">
        {stats.map(({ key, value, icon: Icon, tone, href }) => (
          <button
            key={key}
            data-el={`stat-${key}`}
            onClick={() => router.push(href)}
            className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-accent/50 hover:shadow-md"
          >
            <Icon className={tone === "accent" ? "h-4 w-4 text-accent" : "h-4 w-4 text-primary"} aria-hidden />
            <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t(`dashboard.${key}`)}</div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="zz-serif text-lg font-semibold text-foreground">{t("dashboard.recommend")}</h2>
          <Link
            href="/gaps"
            data-el="dashboard-open-gaps"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/8"
          >
            {t("dashboard.openGap")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {recommend.map((gap) => {
            const clusterLabels = gap.clusterIds
              .map((cid) => clusters.find((c) => c.id === cid))
              .filter(Boolean)
              .map((c) => clusterLabel(c!.label, t));
            const reason = gapReason(gap, fragments);
            return (
              <button
                key={gap.id}
                data-el="dashboard-gap-card"
                onClick={() => writeGap(gap.id)}
                className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-accent/50 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{gap.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t("dashboard.relatedClusters")} · {clusterLabels.join(" / ")}
                    </span>
                    <span>
                      {gap.supportingFragmentIds.length} {t("dashboard.supporting")}
                    </span>
                    <span className="rounded-full bg-accent/12 px-2 py-0.5 font-medium text-accent">
                      {t("gaps.confidence")} {gap.confidence.toFixed(2)}
                    </span>
                  </div>
                  <div data-el="gap-reason" className="mt-1.5 text-xs text-primary/80">
                    {t("dashboard.why")}：{t(`reason.${reason.key}`, reason.params)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent" />
              </button>
            );
          })}
        </div>

        {draftingGaps.length > 0 && (
          <div className="mt-6 space-y-2">
            {draftingGaps.map((gap) => (
              <button
                key={gap.id}
                data-el="dashboard-resume-draft"
                onClick={() => gap.draftId && router.push(`/write/${gap.draftId}`)}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-left text-sm"
              >
                <span className="truncate text-foreground/80">
                  <PenLine className="mr-2 inline h-3.5 w-3.5 text-primary" />
                  {gap.title}
                </span>
                <span className="shrink-0 text-xs font-medium text-primary">{t("dashboard.resume")} →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardInner />
    </AppShell>
  );
}
