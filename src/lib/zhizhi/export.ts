import type { Writing } from "@/lib/zhizhi/types";

// 把一篇成文转成 Markdown（标题 + 正文 + 简单元信息脚注）。
export function writingToMarkdown(w: Writing): string {
  const date = new Date(w.publishedAt).toISOString().slice(0, 10);
  const total = w.userWords + w.aiWords;
  const humanPct = total > 0 ? Math.round((w.userWords / total) * 100) : 100;
  return [
    `# ${w.title}`,
    "",
    w.content.trim(),
    "",
    "---",
    `> ${date} · ${total} words · human ${humanPct}%`,
    "",
  ].join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// 复制富文本：写 text/html + text/plain，粘贴到公众号/富文本编辑器时带排版。
// 不支持 ClipboardItem 的环境回退为纯文本复制。
export async function copyHtmlToClipboard(html: string, plain: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    /* fall through */
  }
  return copyToClipboard(plain);
}

// 触发浏览器下载一个 .md 文件
export function downloadMarkdown(filename: string, markdown: string): void {
  const safe = filename.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) || "writing";
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 导出 PDF：纯前端、零依赖、离线可用（桌面端亦可）。
// 用隐藏 iframe 写入一份干净的打印版 HTML（衬线排版），调用其 print()，
// 用户在系统打印对话框里选择「另存为 PDF」。iframe 方式不弹新窗口、不易被拦截。
// footerLabel 由调用方按当前语言传入（如「2026-08-10 · 1200 字 · 人工 90%」）。
export function printWritingToPdf(w: Writing, footerLabel: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(w.title)}</title>
<style>
  @page { margin: 24mm 20mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Songti SC", "Noto Serif SC", serif;
    color: #1a1a1a; line-height: 1.9; font-size: 15px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1 { font-size: 26px; line-height: 1.3; margin: 0 0 8px; }
  .meta { color: #888; font-size: 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; margin-bottom: 20px; }
  .body { white-space: pre-wrap; }
  .footer { color: #999; font-size: 11px; border-top: 1px solid #e5e5e5; margin-top: 28px; padding-top: 10px; }
</style></head>
<body>
  <h1>${escapeHtml(w.title)}</h1>
  <div class="meta">${escapeHtml(footerLabel)}</div>
  <div class="body">${escapeHtml(w.content.trim())}</div>
  <div class="footer">${escapeHtml(footerLabel)}</div>
</body></html>`;

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  const cleanup = () => {
    // 打印结束后移除 iframe；延时避免部分浏览器在 print() 返回后仍需读取文档。
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 500);
  };

  const trigger = () => {
    try {
      win?.focus();
      win?.addEventListener?.("afterprint", cleanup, { once: true });
      win?.print();
      // 兜底：某些浏览器不触发 afterprint
      setTimeout(cleanup, 60000);
    } catch {
      cleanup();
    }
  };

  // 等资源就绪再打印，避免空白页
  if (doc.readyState === "complete") {
    setTimeout(trigger, 50);
  } else {
    iframe.onload = () => setTimeout(trigger, 50);
  }
}
