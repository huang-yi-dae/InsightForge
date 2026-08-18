"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { FileUp, Import } from "lucide-react";
import { useZhizhi } from "@/lib/zhizhi/store";

/**
 * 存量内容导入：把日记 / 摘抄 / 旧文（粘贴文本或上传 .txt/.md）切成碎片入库，
 * 供「发现可写点」使用。这是产品主线的入口——工具基于你已有的内容做发现。
 */
export function KnowledgeImport() {
  const { t } = useTranslation();
  const { importContent } = useZhizhi();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function doImport(content: string) {
    const n = importContent(content);
    if (n > 0) {
      toast.success(t("import.done", { count: n }));
      setText("");
      setOpen(false);
    } else {
      toast.info(t("import.empty"));
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    let all = "";
    for (const file of Array.from(files)) {
      all += "\n\n" + (await file.text());
    }
    doImport(all);
  }

  if (!open) {
    return (
      <button
        data-el="knowledge-import-open"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/80 hover:border-accent/50 hover:text-foreground"
      >
        <Import className="h-3.5 w-3.5" /> {t("import.open")}
      </button>
    );
  }

  return (
    <div data-el="knowledge-import" className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">{t("import.title")}</div>
        <button
          data-el="knowledge-import-close"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("common.close")}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("import.desc")}</p>

      <textarea
        data-el="knowledge-import-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={t("import.placeholder")}
        className="mt-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          data-el="knowledge-import-submit"
          onClick={() => doImport(text)}
          disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          <Import className="h-4 w-4" /> {t("import.submit")}
        </button>
        <button
          data-el="knowledge-import-file"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground"
        >
          <FileUp className="h-4 w-4" /> {t("import.upload")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <span className="text-xs text-muted-foreground">{t("import.hint")}</span>
      </div>
    </div>
  );
}
