"use client";

import { BookOpen, CheckCircle2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/zhizhi/app-shell";
import { useZhizhi } from "@/lib/zhizhi/store";
import { aiRatio } from "@/lib/zhizhi/types";
import { copyToClipboard, downloadMarkdown, writingToMarkdown } from "@/lib/zhizhi/export";

function LibraryInner() {
  const { t } = useTranslation();
  const { writings } = useZhizhi();

  return (
    <div data-el="library" className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="zz-serif text-2xl font-bold text-foreground md:text-3xl">{t("library.title")}</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t("library.subtitle")}</p>

      {writings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          {t("library.empty")}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {writings.map((w) => {
            const humanShare = Math.round((1 - aiRatio(w.userWords, w.aiWords)) * 100);
            return (
              <article
                key={w.id}
                data-el="library-writing"
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="zz-serif text-lg font-semibold leading-snug text-foreground">{w.title}</h2>
                  {w.reflowed && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-medium text-accent">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t("library.reflowed")}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/70">{w.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {t("library.words", { count: w.userWords + w.aiWords })}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {t("library.humanShare", { ratio: humanShare })}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      data-el="library-copy-md"
                      onClick={async () => {
                        const ok = await copyToClipboard(writingToMarkdown(w));
                        toast[ok ? "success" : "error"](t(ok ? "library.copied" : "library.copyFailed"));
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground/70 hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" /> {t("library.copyMd")}
                    </button>
                    <button
                      data-el="library-download-md"
                      onClick={() => {
                        downloadMarkdown(w.title, writingToMarkdown(w));
                        toast.success(t("library.downloaded"));
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground/70 hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" /> {t("library.downloadMd")}
                    </button>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <AppShell>
      <LibraryInner />
    </AppShell>
  );
}
