"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  Minus,
  Network,
  Pencil,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useZhizhi } from "@/lib/zhizhi/store";
import { aiRatio, type Fragment } from "@/lib/zhizhi/types";
import { clusterLabel } from "@/lib/zhizhi/cluster-label";
import { recommendFragmentsForGap } from "@/lib/zhizhi/discovery";
import { relatedWritings } from "@/lib/zhizhi/related";
import { copyToClipboard, downloadMarkdown, printWritingToPdf, writingToMarkdown } from "@/lib/zhizhi/export";
import { PublishButtons } from "@/components/zhizhi/publish-buttons";

export function LibraryDetailScreen({ writingId }: { writingId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    ready,
    writings,
    fragments,
    clusters,
    gaps,
    getGap,
    fragmentsForGap,
    toggleGapFragment,
  } = useZhizhi();
  const [query, setQuery] = useState("");

  const writing = writings.find((w) => w.id === writingId);
  const gap = writing ? getGap(writing.gapId) : undefined;
  const cited = useMemo(
    () => (writing ? fragmentsForGap(writing.gapId) : []),
    [writing, fragmentsForGap],
  );
  const citedIds = useMemo(() => cited.map((f) => f.id), [cited]);

  const clusterName = useMemo(() => {
    const map = new Map(clusters.map((c) => [c.id, c.label]));
    return (fid: string) => {
      const f = fragments.find((x) => x.id === fid);
      const label = f ? map.get(f.clusterId) : undefined;
      return label ? clusterLabel(label, t) : "";
    };
  }, [clusters, fragments, t]);

  // 3a. 库内搜索：在全部碎片里按内容匹配，排除已引用的
  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const citedSet = new Set(citedIds);
    return fragments.filter((f) => !citedSet.has(f.id) && f.content.includes(q)).slice(0, 8);
  }, [query, fragments, citedIds]);

  // 3b. 系统按主题推荐（库内、无外网）
  const recommended = useMemo(
    () => (gap ? recommendFragmentsForGap(fragments, citedIds, 6) : []),
    [gap, fragments, citedIds],
  );

  // 相关成文：共享概念簇/引用碎片的其他成文，让知识成网
  const related = useMemo(
    () => (writing ? relatedWritings(writing, writings, gaps, 4) : []),
    [writing, writings, gaps],
  );

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-muted-foreground md:px-8">
        {t("common.loading")}
      </div>
    );
  }

  if (!writing) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8">
        <BackBtn onClick={() => router.push("/library")} label={t("common.back")} />
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          {t("library.detailNotFound")}
        </div>
      </div>
    );
  }

  const humanShare = Math.round((1 - aiRatio(writing.userWords, writing.aiWords)) * 100);
  const publishedDate = new Date(writing.publishedAt).toLocaleDateString();

  const FragRow = ({ f, mode }: { f: Fragment; mode: "cited" | "add" }) => (
    <li
      data-el="detail-fragment"
      className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-foreground/80">{f.content}</p>
        {clusterName(f.id) && (
          <span className="mt-1 inline-block text-[11px] text-muted-foreground">
            {clusterName(f.id)}
          </span>
        )}
      </div>
      <button
        data-el={mode === "cited" ? "detail-frag-remove" : "detail-frag-add"}
        onClick={() => {
          toggleGapFragment(writing.gapId, f.id);
          toast.success(t(mode === "cited" ? "library.refRemoved" : "library.refAdded"));
        }}
        className={
          mode === "cited"
            ? "mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            : "mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        }
        aria-label={mode === "cited" ? t("library.refRemove") : t("library.refAdd")}
      >
        {mode === "cited" ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {mode === "cited" ? t("library.refRemove") : t("library.refAdd")}
      </button>
    </li>
  );

  return (
    <article data-el="library-detail" className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <BackBtn onClick={() => router.push("/library")} label={t("common.back")} />

      <header className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="zz-serif text-2xl font-bold leading-snug text-foreground md:text-3xl">
            {writing.title}
          </h1>
          {writing.reflowed && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-medium text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("library.reflowed")}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {t("library.words", { count: writing.userWords + writing.aiWords })}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {t("library.humanShare", { ratio: humanShare })}
          </span>
          <span>{t("library.detailPublished", { date: publishedDate })}</span>
        </div>

        {/* 1. 修改按钮（跳写作页继续编辑） */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            data-el="library-detail-edit"
            onClick={() => router.push(`/write/${writing.draftId}`)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Pencil className="h-4 w-4" /> {t("library.edit")}
          </button>
        </div>
      </header>

      {/* 2. 引用管理：这篇引用了哪些碎片 */}
      <section data-el="library-detail-refs" className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">
          {t("library.references", { count: cited.length })}
        </h2>
        {cited.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{t("library.refEmpty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {cited.map((f) => (
              <FragRow key={f.id} f={f} mode="cited" />
            ))}
          </ul>
        )}

        {/* 3a. 库内搜索加挂 */}
        <div className="mt-6">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              data-el="library-detail-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("library.refSearchPlaceholder")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          {query.trim() && (
            <ul className="mt-3 space-y-2">
              {searchResults.length === 0 ? (
                <li className="text-xs text-muted-foreground">{t("library.refSearchEmpty")}</li>
              ) : (
                searchResults.map((f) => <FragRow key={f.id} f={f} mode="add" />)
              )}
            </ul>
          )}
        </div>

        {/* 3b. 系统按主题推荐（库内相关碎片） */}
        {recommended.length > 0 && (
          <div className="mt-6">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-accent" /> {t("library.refRecommend")}
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("library.refRecommendHint")}</p>
            <ul className="mt-3 space-y-2">
              {recommended.map((f) => (
                <FragRow key={f.id} f={f} mode="add" />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 全文正文 */}
      <div
        data-el="library-detail-body"
        className="zz-serif mt-8 whitespace-pre-wrap border-t border-border pt-6 text-[15px] leading-loose text-foreground/90"
      >
        {writing.content}
      </div>

      {/* 相关成文：让知识成网 */}
      {related.length > 0 && (
        <section data-el="library-detail-related" className="mt-8 border-t border-border pt-6">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Network className="h-4 w-4 text-accent" /> {t("library.related")}
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("library.relatedHint")}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.writing.id}>
                <Link
                  href={`/library/${r.writing.id}`}
                  data-el="library-related-item"
                  className="block h-full rounded-lg border border-border bg-card px-3 py-2.5 transition-all hover:border-accent/50 hover:shadow-sm"
                >
                  <div className="zz-serif truncate text-sm font-semibold text-foreground">{r.writing.title}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("library.relatedShared", {
                      clusters: r.sharedClusters,
                      fragments: r.sharedFragments,
                    })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-5">
        <button
          data-el="library-detail-copy-md"
          onClick={async () => {
            const ok = await copyToClipboard(writingToMarkdown(writing));
            toast[ok ? "success" : "error"](t(ok ? "library.copied" : "library.copyFailed"));
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          <Copy className="h-4 w-4" /> {t("library.copyMd")}
        </button>
        <button
          data-el="library-detail-download-md"
          onClick={() => {
            downloadMarkdown(writing.title, writingToMarkdown(writing));
            toast.success(t("library.downloaded"));
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          <Download className="h-4 w-4" /> {t("library.downloadMd")}
        </button>
        <button
          data-el="library-detail-download-pdf"
          onClick={() =>
            printWritingToPdf(
              writing,
              t("library.pdfMeta", {
                date: publishedDate,
                count: writing.userWords + writing.aiWords,
                ratio: humanShare,
              }),
            )
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          <FileDown className="h-4 w-4" /> {t("library.downloadPdf")}
        </button>
      </div>

      <PublishButtons writing={writing} />
    </article>
  );
}

function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      data-el="library-detail-back"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
