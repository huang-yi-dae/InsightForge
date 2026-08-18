"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Search as SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/zhizhi/app-shell";
import { useZhizhi } from "@/lib/zhizhi/store";
import { searchKnowledge, tokenizeQuery, type SearchHit } from "@/lib/zhizhi/search";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 统计 snippet 内实际出现了多少个不同关键词（与高亮一致）
function countMatchedTerms(snippet: string, keywords: string[]): number {
  const lower = snippet.toLowerCase();
  return keywords.filter((k) => k && lower.includes(k)).length;
}

// 对 snippet 内出现的【所有】关键词做全量高亮（大小写不敏感），而非仅首个命中区间。
function Highlight({ hit, keywords }: { hit: SearchHit; keywords: string[] }) {
  const terms = keywords.filter(Boolean);
  if (terms.length === 0) {
    return <span className="text-sm leading-relaxed text-foreground/75">{hit.snippet}</span>;
  }
  const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = hit.snippet.split(re);
  return (
    <span className="text-sm leading-relaxed text-foreground/75">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-accent/25 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function hrefForHit(hit: SearchHit): string {
  return hit.kind === "writing" ? `/library/${hit.id}` : "/gaps";
}

function SearchInner() {
  const { t } = useTranslation();
  const { fragments, writings } = useZhizhi();
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchKnowledge(query, { fragments, writings }),
    [query, fragments, writings],
  );
  const keywords = useMemo(() => tokenizeQuery(query), [query]);
  const trimmed = query.trim();

  return (
    <div data-el="search" className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="zz-serif text-2xl font-bold text-foreground md:text-3xl">{t("search.title")}</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t("search.subtitle")}</p>

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm focus-within:border-accent/50">
        <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          data-el="search-input"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {trimmed === "" ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          {t("search.hint")}
        </div>
      ) : results.length === 0 ? (
        <div
          data-el="search-empty"
          className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground"
        >
          {t("search.empty")}
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted-foreground">{t("search.resultCount", { count: results.length })}</p>
          <div className="mt-3 space-y-3">
            {results.map((hit) => (
              <Link
                key={`${hit.kind}-${hit.id}`}
                href={hrefForHit(hit)}
                data-el={`search-hit-${hit.kind}`}
                className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-accent/50 hover:shadow-md"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={
                      hit.kind === "writing"
                        ? "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                        : "inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent"
                    }
                  >
                    {hit.kind === "writing" ? (
                      <><BookOpen className="h-3 w-3" aria-hidden /> {t("search.kindWriting")}</>
                    ) : (
                      <><FileText className="h-3 w-3" aria-hidden /> {t("search.kindFragment")}</>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{hit.title}</span>
                  {keywords.length > 1 && countMatchedTerms(hit.snippet, keywords) > 1 && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t("search.matchedTerms", { count: countMatchedTerms(hit.snippet, keywords) })}
                    </span>
                  )}
                </div>
                <Highlight hit={hit} keywords={keywords} />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <AppShell>
      <SearchInner />
    </AppShell>
  );
}
