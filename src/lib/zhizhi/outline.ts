// 大纲：从正文里的 markdown 标题行提取文档结构，供写作页快速定位。
// 纯函数、可测。识别行首 1-6 个 # 后跟空格的标题；忽略引用块(>)里的 #。

export interface OutlineItem {
  level: number; // 1-6
  text: string;
  line: number; // 0-based 行号，供定位/滚动
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function extractOutline(content: string): OutlineItem[] {
  if (!content) return [];
  const items: OutlineItem[] = [];
  const lines = content.split("\n");
  lines.forEach((raw, i) => {
    // 引用块内的 # 不算标题
    if (/^\s*>/.test(raw)) return;
    const m = HEADING_RE.exec(raw.trim());
    if (m) {
      items.push({ level: m[1].length, text: m[2].trim(), line: i });
    }
  });
  return items;
}
