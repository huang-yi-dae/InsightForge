"use client";

import { Quote } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Fragment } from "@/lib/zhizhi/types";
import { cn } from "@/utils/utils";

interface SourcePanelProps {
  fragments: Fragment[];
  citedIds: string[];
  onInsert: (fragment: Fragment) => void;
}

// 右栏：相关碎片素材，如剪报可插入引用（引用计入你的产出并盘活碎片）
export function SourcePanel({ fragments, citedIds, onInsert }: SourcePanelProps) {
  const { t } = useTranslation();

  return (
    <div data-el="source-panel" className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <span className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("write.sourceTitle")}
      </span>
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {fragments.map((f) => {
          const cited = citedIds.includes(f.id);
          return (
            <div
              key={f.id}
              data-el="source-fragment"
              className={cn(
                "rounded-lg border p-3 text-xs leading-relaxed transition-colors",
                cited ? "border-accent/40 bg-accent/8" : "border-border bg-background/60",
              )}
            >
              <p className="text-foreground/80">{f.content}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">#{f.id}</span>
                <button
                  data-el="source-insert"
                  disabled={cited}
                  onClick={() => onInsert(f)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary disabled:text-accent disabled:opacity-100"
                >
                  <Quote className="h-3 w-3" />
                  {cited ? t("write.inserted") : t("write.insertQuote")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
