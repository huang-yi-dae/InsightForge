// 风格检查：识别正文里的「废话词 / 冗余表达」，帮创作者提炼文字（借鉴 iA Writer 的 Style Check）。
// 纯函数、无副作用、可测。仅做「提示」，绝不自动改写——契合织知「血肉是你的」定位。
//
// 词典分两类：
// - zh：中文常见弱化/冗余词（口头禅、程度虚词、赘余动词结构）。
// - en：英文常见 filler / weasel words，词边界匹配、大小写不敏感。

const ZH_FILLERS = [
  "其实", "基本上", "非常", "十分", "特别", "真的", "我觉得", "我认为",
  "一些", "一点点", "有点", "进行", "通过这种方式", "众所周知", "总的来说",
  "换句话说", "也就是说", "在很大程度上", "或多或少", "可以说", "某种程度上",
];

// 英文用词边界，避免命中 "justice" 里的 "just"
const EN_FILLERS = [
  "very", "really", "just", "actually", "basically", "literally",
  "quite", "somewhat", "kind of", "sort of", "in order to", "a lot of",
];

export interface StyleFlag {
  word: string;
  index: number; // 命中在原文中的起始下标
  length: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 判断某个英文命中的两侧是否为单词边界（\w 视为词内字符）
function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9]/.test(ch);
}

/**
 * 扫描文本，返回全部废话词命中（按出现位置升序）。
 * 中文子串直接匹配；英文需词边界 + 大小写不敏感。
 */
export function checkStyle(text: string): StyleFlag[] {
  if (!text) return [];
  const flags: StyleFlag[] = [];

  // 中文：直接子串扫描（可重叠位置不重复）
  for (const w of ZH_FILLERS) {
    let from = 0;
    while (true) {
      const idx = text.indexOf(w, from);
      if (idx < 0) break;
      flags.push({ word: w, index: idx, length: w.length });
      from = idx + w.length;
    }
  }

  // 英文：词边界 + 忽略大小写
  const lower = text.toLowerCase();
  for (const w of EN_FILLERS) {
    const re = new RegExp(escapeRegExp(w.toLowerCase()), "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      const start = m.index;
      const end = start + w.length;
      // 短语（含空格）不做词边界；单词才校验两侧边界
      const hasSpace = w.includes(" ");
      if (!hasSpace && (isWordChar(text[start - 1]) || isWordChar(text[end]))) {
        continue;
      }
      flags.push({ word: text.slice(start, end), index: start, length: w.length });
      if (re.lastIndex === m.index) re.lastIndex++; // 防零宽死循环
    }
  }

  flags.sort((a, b) => a.index - b.index);
  return flags;
}

/** 统计命中数量，供 UI 展示「N 处可精简」。 */
export function countStyleFlags(text: string): number {
  return checkStyle(text).length;
}
