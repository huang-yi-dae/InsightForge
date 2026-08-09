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
