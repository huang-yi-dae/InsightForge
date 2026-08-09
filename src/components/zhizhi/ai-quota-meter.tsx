"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";

interface AIQuotaMeterProps {
  ratio: number; // 0-1 当前 AI 占比
  limit: number; // 0-1 阈值
  compact?: boolean;
}

// 反代写仪表：AI 占比逼近/超过阈值即变红告警
export function AIQuotaMeter({ ratio, limit, compact }: AIQuotaMeterProps) {
  const { t } = useTranslation();
  const pct = Math.round(ratio * 100);
  const over = ratio > limit;
  const fill = Math.min(100, limit === 0 ? (over ? 100 : 0) : (ratio / limit) * 100);

  return (
    <div
      data-el="ai-quota-meter"
      className={cn(
        "flex items-center gap-2 rounded-full border px-2.5 py-1",
        over
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-card text-muted-foreground",
      )}
      title={over ? t("quota.over") : t("quota.ok")}
    >
      {over ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      )}
      {!compact && <span className="text-[11px] font-medium">{t("quota.label")}</span>}
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-primary/10">
        <div
          className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : "bg-accent")}
          style={{ width: `${fill}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}
