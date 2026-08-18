"use client";

import { useEffect, useMemo, useState } from "react";
import { Award } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Writing } from "@/lib/zhizhi/types";
import { computeWritingStreak } from "@/lib/zhizhi/streak";
import { weeklyWordSeries, earnedBadges, summarizeWritings } from "@/lib/zhizhi/metrics";

// 写作度量卡：近 7 日发布字数柱状图 + 成就徽章。
// 依赖当前日期，故 client-only 渲染，避免 SSR 水合不一致。
export function MetricsCard({ writings }: { writings: Writing[] }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const { series, badges, totalWords } = useMemo(() => {
    const s = weeklyWordSeries(writings);
    const { totalWords, publishedCount } = summarizeWritings(writings);
    const streak = computeWritingStreak(writings.map((w) => w.publishedAt));
    return {
      series: s,
      totalWords,
      badges: earnedBadges({ totalWords, publishedCount, streak: streak.current }),
    };
  }, [writings]);

  if (!mounted) return null;

  const max = Math.max(1, ...series.map((d) => d.words));

  return (
    <section data-el="metrics-card" className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("metrics.weekTitle")}</h2>
        <span className="text-xs text-muted-foreground">
          {t("metrics.totalWords", { count: totalWords })}
        </span>
      </div>

      {/* 近 7 日字数柱状图 */}
      <div className="mt-4 flex h-24 items-end gap-2">
        {series.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className={
                  "w-full rounded-t transition-all " +
                  (d.words > 0
                    ? d.isToday
                      ? "bg-accent"
                      : "bg-primary/70"
                    : "bg-muted")
                }
                style={{ height: `${Math.max(4, (d.words / max) * 100)}%` }}
                title={`${d.words}`}
              />
            </div>
            <span className={"text-[10px] " + (d.isToday ? "font-semibold text-accent" : "text-muted-foreground")}>
              {d.label}
            </span>
          </div>
        ))}
      </div>

      {/* 成就徽章 */}
      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-foreground/70">
        <Award className="h-3.5 w-3.5" /> {t("metrics.badges")}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {badges.map((b) => (
          <span
            key={b.id}
            data-el={`badge-${b.id}`}
            className={
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors " +
              (b.earned
                ? "border-accent/40 bg-accent/12 text-accent"
                : "border-border bg-muted/40 text-muted-foreground")
            }
            title={b.earned ? "" : `${Math.round(b.progress * 100)}%`}
          >
            {t(`metrics.badge.${b.id}`)}
            {!b.earned && b.progress > 0 && (
              <span className="ml-1 tabular-nums opacity-70">{Math.round(b.progress * 100)}%</span>
            )}
          </span>
        ))}
      </div>
    </section>
  );
}
