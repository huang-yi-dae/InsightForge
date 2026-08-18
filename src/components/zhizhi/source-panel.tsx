"use client";

import { Quote, X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Fragment } from "@/lib/zhizhi/types";
import { cn } from "@/utils/utils";

interface SourcePanelProps {
  fragments: Fragment[];
  citedIds: string[];
  onInsert: (fragment: Fragment) => void;
  onRemove: (fragment: Fragment) => void;
}

// 右栏：相关碎片素材，可插入引用；已插入的可再点撤回（引用计入你的产出并盘活碎片）
export function SourcePanel({ fragments, citedIds, onInsert, onRemove }: SourcePanelProps) {
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
                cited ? "border-accent/50 bg-accent/8" : "border-border bg-background/60",
              )}
            >
              <p className="text-foreground/80">{f.content}</p>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {cited && <Check className="h-3 w-3 text-accent" />}#{f.id}
                </span>
                {cited ? (
                  <button
                    data-el="source-remove"
                    onClick={() => onRemove(f)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("write.removeQuote")}
                  </button>
                ) : (
                  <button
                    data-el="source-insert"
                    onClick={() => onInsert(f)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    <Quote className="h-3.5 w-3.5" />
                    {t("write.insertQuote")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
