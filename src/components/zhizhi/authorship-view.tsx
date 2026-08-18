"use client";

import { Fragment as RFragment, useMemo, useState } from "react";
import { PenLine, Quote, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import { countWords } from "@/lib/zhizhi/types";
import { checkStyle } from "@/lib/zhizhi/style-check";

// Authorship 可视化：把正文按行拆分，区分「你亲手写的」与「AI/素材引用插入的」。
// 引用/AI 插入的内容以 markdown 引用块（前缀 `>`）形式落入画布（见 write-screen onInsert），
// 因此这里用行首 `>` 作为「非你手写」的判定信号——零数据结构改动，纯展示层。
// 呼应织知「反代写」定位：让创作者一眼看清哪些字真的出自自己。
// 叠加「风格检查」：在你亲手写的段落里高亮废话/冗余词（借鉴 iA Writer Style Check），仅提示不改写。

interface Segment {
  kind: "you" | "quote";
  text: string;
}

// 连续的引用行合并成一段引用块；连续的非引用行合并成一段「你写的」。
function segmentize(content: string): Segment[] {
  const lines = content.split("\n");
  const segments: Segment[] = [];
  for (const line of lines) {
    const isQuote = /^\s*>\s?/.test(line);
    const kind: Segment["kind"] = isQuote ? "quote" : "you";
    const text = isQuote ? line.replace(/^\s*>\s?/, "") : line;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.text += "\n" + text;
    } else {
      segments.push({ kind, text });
    }
  }
  return segments.filter((s) => s.text.trim().length > 0);
}

// 把一段文本按风格命中切成 普通/高亮 交替片段渲染。
function StyledText({ text }: { text: string }) {
  const flags = useMemo(() => checkStyle(text), [text]);
  if (flags.length === 0) return <>{text}</>;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  flags.forEach((f, i) => {
    if (f.index < cursor) return; // 跳过重叠命中
    if (f.index > cursor) nodes.push(<RFragment key={`t${i}`}>{text.slice(cursor, f.index)}</RFragment>);
    nodes.push(
      <mark
        key={`m${i}`}
        data-el="style-flag"
        className="rounded bg-amber-300/40 px-0.5 underline decoration-amber-500/60 decoration-wavy underline-offset-2"
      >
        {text.slice(f.index, f.index + f.length)}
      </mark>,
    );
    cursor = f.index + f.length;
  });
  if (cursor < text.length) nodes.push(<RFragment key="tail">{text.slice(cursor)}</RFragment>);
  return <>{nodes}</>;
}

export function AuthorshipView({ content }: { content: string }) {
  const { t } = useTranslation();
  const [styleOn, setStyleOn] = useState(false);
  const segments = useMemo(() => segmentize(content), [content]);

  const { yourWords, quoteWords } = useMemo(() => {
    let you = 0;
    let quote = 0;
    for (const s of segments) {
      const w = countWords(s.text);
      if (s.kind === "you") you += w;
      else quote += w;
    }
    return { yourWords: you, quoteWords: quote };
  }, [segments]);

  // 只统计「你写的」段落的风格命中数
  const styleCount = useMemo(
    () => segments.filter((s) => s.kind === "you").reduce((n, s) => n + checkStyle(s.text).length, 0),
    [segments],
  );

  const total = yourWords + quoteWords;
  const youPct = total === 0 ? 0 : Math.round((yourWords / total) * 100);

  if (segments.length === 0) {
    return (
      <div data-el="authorship-empty" className="py-10 text-center text-sm text-muted-foreground">
        {t("authorship.empty")}
      </div>
    );
  }

  return (
    <div data-el="authorship-view" className="flex h-full flex-col">
      {/* 图例 + 你写占比 */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-accent">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          {t("authorship.you")} · {yourWords}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-primary/70">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/40" aria-hidden />
          {t("authorship.quote")} · {quoteWords}
        </span>
        <span className="ml-auto rounded-full bg-accent/12 px-2 py-0.5 font-semibold tabular-nums text-accent">
          {t("authorship.youShare", { pct: youPct })}
        </span>
      </div>

      {/* 风格检查开关 + 计数 */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          data-el="style-toggle"
          onClick={() => setStyleOn((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors",
            styleOn
              ? "border-amber-500/50 bg-amber-300/20 text-amber-700 dark:text-amber-300"
              : "border-border bg-background text-foreground/70 hover:border-accent/50 hover:text-accent",
          )}
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden /> {t("authorship.styleToggle")}
        </button>
        {styleOn && (
          <span className="text-muted-foreground">
            {styleCount > 0 ? t("authorship.styleCount", { count: styleCount }) : t("authorship.styleClean")}
          </span>
        )}
      </div>

      {/* 渲染层：你写的正常显示（可叠加风格高亮），引用块加左边框+浅底并标注来源 */}
      <div className="zz-serif flex-1 space-y-3 overflow-y-auto text-[15px] leading-8">
        {segments.map((s, i) =>
          s.kind === "you" ? (
            <p key={i} className="whitespace-pre-wrap text-foreground">
              {styleOn ? <StyledText text={s.text} /> : s.text}
            </p>
          ) : (
            <div
              key={i}
              data-el="authorship-quote"
              className={cn(
                "relative rounded-r-md border-l-[3px] border-primary/40 bg-primary/[0.06] py-1.5 pl-3 pr-2",
              )}
            >
              <span className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary/60">
                <Quote className="h-3 w-3" aria-hidden />
                {t("authorship.quoteTag")}
              </span>
              <p className="whitespace-pre-wrap text-foreground/75">{s.text}</p>
            </div>
          ),
        )}
      </div>

      <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <PenLine className="h-3 w-3 text-accent" aria-hidden />
        {styleOn ? t("authorship.styleTip") : t("authorship.hint")}
      </p>
    </div>
  );
}
