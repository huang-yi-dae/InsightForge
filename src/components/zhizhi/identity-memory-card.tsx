"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useZhizhi } from "@/lib/zhizhi/store";
import {
  observeWritings,
  proposeIdentityUpdates,
  applyProposal,
  type IdentityProposal,
} from "@/lib/zhizhi/identity-memory";

// 身份档案「记忆机制」入口：AI 从你已发布的成文里观察出建议，
// 你一键采纳或忽略——只提议、不静默改写。
export function IdentityMemoryCard() {
  const { t } = useTranslation();
  const { writings, identity, setIdentity } = useZhizhi();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const proposals = useMemo(() => {
    const obs = observeWritings(writings);
    return proposeIdentityUpdates(identity, obs);
  }, [writings, identity]);

  const visible = proposals.filter((p) => !dismissed.has(p.field));
  if (visible.length === 0) return null;

  const accept = (p: IdentityProposal) => {
    setIdentity(applyProposal(p));
    toast.success(t("memory.accepted"));
  };
  const ignore = (p: IdentityProposal) =>
    setDismissed((prev) => new Set(prev).add(p.field));

  return (
    <div data-el="identity-memory" className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-center gap-1.5 text-sm font-medium text-accent">
        <Sparkles className="h-4 w-4" /> {t("memory.title")}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("memory.desc")}</p>
      <div className="mt-3 space-y-2">
        {visible.map((p) => (
          <div
            key={p.field}
            data-el={`memory-proposal-${p.field}`}
            className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground/60">
                {t(`settings.id${p.field === "pointOfView" ? "Pov" : p.field[0].toUpperCase() + p.field.slice(1)}`)}
              </div>
              <div className="mt-0.5 text-sm text-foreground">
                <span className="text-muted-foreground">＋</span> {p.added}
              </div>
              <div className="mt-1 text-xs text-primary/80">
                {t(`memory.reason.${p.reasonKey}`, p.reasonParams)}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                data-el={`memory-accept-${p.field}`}
                onClick={() => accept(p)}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" /> {t("memory.accept")}
              </button>
              <button
                data-el={`memory-ignore-${p.field}`}
                onClick={() => ignore(p)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                aria-label={t("memory.ignore")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
