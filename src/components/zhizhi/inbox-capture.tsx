"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Inbox, Plus } from "lucide-react";
import { useZhizhi } from "@/lib/zhizhi/store";

/**
 * 快速采集 Inbox：一个输入框随手存碎片 → 自动归到最匹配的簇 → 计入 today's inflow。
 * 这是「回流飞轮」的入口：碎片越多，空白勘探越准。
 */
export function InboxCapture() {
  const { t } = useTranslation();
  const { captureFragment, guardrails, todayInflow } = useZhizhi();
  const [text, setText] = useState("");

  const overLimit = todayInflow >= guardrails.dailyInflowLimit;

  function submit() {
    const value = text.trim();
    if (!value) return;
    captureFragment(value);
    setText("");
    toast.success(t("inbox.saved"));
  }

  return (
    <div data-el="inbox-capture" className="mt-5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Inbox className="h-3.5 w-3.5 text-accent" />
        {t("inbox.title")}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          data-el="inbox-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={2}
          placeholder={t("inbox.placeholder")}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
        />
        <button
          data-el="inbox-submit"
          onClick={submit}
          disabled={!text.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> {t("inbox.add")}
        </button>
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {overLimit ? (
          <span className="text-destructive">{t("inbox.overLimit")}</span>
        ) : (
          t("inbox.hint")
        )}
      </div>
    </div>
  );
}
