// 版本历史：为草稿正文保留本地快照，可回看/恢复。纯函数管理快照列表，
// 由组件负责持久化（localStorage，不进共享 DB）。设计成可测的不可变操作。

export interface Snapshot {
  content: string;
  at: string; // ISO 时间
}

export interface SnapshotOptions {
  /** 距上一条快照至少间隔多少毫秒才再存（防抖，避免每次按键都存） */
  minGapMs?: number;
  /** 最多保留多少条，超出丢弃最旧的 */
  maxKeep?: number;
}

const DEFAULT_MIN_GAP = 60_000; // 1 分钟
const DEFAULT_MAX_KEEP = 20;

/**
 * 尝试把当前内容作为新快照追加到列表头部（最新在前）。
 * 规则：
 * - 内容为空 → 不存。
 * - 与最新一条内容相同 → 不存（去重）。
 * - 距最新一条时间不足 minGapMs → 不存（防抖）。
 * 返回新列表（可能与输入相同引用之外的新数组）。
 */
export function pushSnapshot(
  list: Snapshot[],
  content: string,
  now: Date = new Date(),
  opts: SnapshotOptions = {},
): Snapshot[] {
  const minGap = opts.minGapMs ?? DEFAULT_MIN_GAP;
  const maxKeep = opts.maxKeep ?? DEFAULT_MAX_KEEP;

  if (!content.trim()) return list;

  const latest = list[0];
  if (latest) {
    if (latest.content === content) return list; // 无变化
    if (now.getTime() - new Date(latest.at).getTime() < minGap) {
      // 间隔不足：用当前内容替换最新一条（保留时间戳），避免频繁增条又不丢失最新
      const replaced = [{ content, at: latest.at }, ...list.slice(1)];
      return replaced;
    }
  }

  const next = [{ content, at: now.toISOString() }, ...list];
  return next.slice(0, Math.max(1, maxKeep));
}

/** 生成快照的简短摘要（首行 + 字数），供列表展示。 */
export function snapshotSummary(s: Snapshot): { firstLine: string; chars: number } {
  const firstLine = s.content.split("\n").find((l) => l.trim().length > 0)?.slice(0, 40) ?? "";
  const chars = (s.content.match(/\S/gu) || []).length;
  return { firstLine, chars };
}
