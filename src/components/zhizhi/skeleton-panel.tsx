"use client";

import { useState } from "react";
import { Sparkles, Loader2, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Skeleton } from "@/lib/zhizhi/types";

interface SkeletonPanelProps {
  skeleton?: Skeleton;
  generating: boolean;
  onGenerate: () => void;
  onExpand: (heading: string) => void;
  expandUses: number;
  expandLimit: number;
  expanded: Record<string, string[]>; // heading -> extra bullet hints
}

// 左栏：AI 只读骨架。视觉上明确标注「这是提示，不是你」；只出提纲，不出成段文字。
export function SkeletonPanel({
  skeleton,
  generating,
  onGenerate,
  onExpand,
  expandUses,
  expandLimit,
  expanded,
}: SkeletonPanelProps) {
  const { t } = useTranslation();
  const [busyHeading, setBusyHeading] = useState<string | null>(null);
  const left = Math.max(0, expandLimit - expandUses);

  return (
    <div
      data-el="skeleton-panel"
      className="flex h-full flex-col rounded-xl border border-secondary/30 bg-secondary/8 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground/80">
          {t("write.skeletonTitle")}
        </span>
        <span className="rounded-full border border-secondary/40 bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t("write.skeletonBadge")}
        </span>
      </div>

      {generating ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-secondary/25" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-secondary/15" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-secondary/15" />
            </div>
          ))}
          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("write.generating")}
          </p>
        </div>
      ) : skeleton ? (
        <div className="flex-1 space-y-4 overflow-y-auto">
          <ol className="space-y-3">
            {skeleton.points.map((p, i) => (
              <li key={i} data-el="skeleton-point">
                <div className="flex items-baseline gap-2">
                  <span className="zz-serif text-sm font-bold text-secondary-foreground">{i + 1}.</span>
                  <span className="text-sm font-medium text-foreground">{p.heading}</span>
                </div>
                <ul className="mt-1 space-y-1 pl-5">
                  {p.bullets.map((b, j) => (
                    <li key={j} className="list-disc text-xs leading-relaxed text-foreground/70">
                      {b}
                    </li>
                  ))}
                  {expanded[p.heading]?.map((b, j) => (
                    <li key={`e-${j}`} className="list-disc text-xs leading-relaxed text-accent">
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  data-el="skeleton-expand"
                  disabled={left <= 0}
                  onClick={async () => {
                    setBusyHeading(p.heading);
                    await onExpand(p.heading);
                    setBusyHeading(null);
                  }}
                  className="mt-1.5 ml-5 inline-flex items-center gap-1 text-[11px] font-medium text-primary disabled:opacity-40"
                >
                  <Lightbulb className="h-3 w-3" />
                  {busyHeading === p.heading ? t("write.generating") : t("write.requestExpand")}
                </button>
              </li>
            ))}
          </ol>
          <p className="border-t border-secondary/25 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            {t("write.expandLeft", { left, total: expandLimit })} · {t("write.expandNote")}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <Sparkles className="h-6 w-6 text-secondary" />
          <Button data-el="skeleton-generate" onClick={onGenerate} className="gap-1.5">
            <Sparkles className="h-4 w-4" /> {t("write.generate")}
          </Button>
        </div>
      )}
    </div>
  );
}
