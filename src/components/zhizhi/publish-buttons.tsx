"use client";

import { toast } from "sonner";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Writing } from "@/lib/zhizhi/types";
import { copyHtmlToClipboard, copyToClipboard } from "@/lib/zhizhi/export";
import {
  toWeixinHtml,
  toStandardMarkdown,
  toWordPressHtml,
} from "@/lib/zhizhi/publish-format";

// 发布集成：一键把成文复制为各平台可直接粘贴的格式。
// 公众号走富文本（text/html）复制，粘贴即带排版；MD / WordPress 复制纯文本。
export function PublishButtons({ writing }: { writing: Writing }) {
  const { t } = useTranslation();

  const notify = (ok: boolean) =>
    toast[ok ? "success" : "error"](t(ok ? "publish.copied" : "library.copyFailed"));

  const targets: { key: string; el: string; run: () => Promise<boolean> }[] = [
    {
      key: "publish.weixin",
      el: "publish-weixin",
      run: () => copyHtmlToClipboard(toWeixinHtml(writing), toStandardMarkdown(writing)),
    },
    {
      key: "publish.markdown",
      el: "publish-markdown",
      run: () => copyToClipboard(toStandardMarkdown(writing)),
    },
    {
      key: "publish.wordpress",
      el: "publish-wordpress",
      run: () => copyToClipboard(toWordPressHtml(writing)),
    },
  ];

  return (
    <section className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
        <Send className="h-4 w-4" /> {t("publish.title")}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("publish.hint")}</p>
      <div className="flex flex-wrap gap-2">
        {targets.map((tg) => (
          <button
            key={tg.key}
            data-el={tg.el}
            onClick={async () => notify(await tg.run())}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {t(tg.key)}
          </button>
        ))}
      </div>
    </section>
  );
}
