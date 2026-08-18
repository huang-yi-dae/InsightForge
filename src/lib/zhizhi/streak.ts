// 写作连续天数（streak）：从已发布成文的发布日期计算「你连续多少天在写」，
// 呼应织知「用产出倒逼输入」的正向激励——不是催收集，而是奖励真正写完并发布。
// 纯函数 + 可注入 now，便于测试与 SSR 一致性。

/** 把 ISO 时间数组归一到「本地日历日」(YYYY-MM-DD) 的去重集合。 */
function toDaySet(isoDates: string[]): Set<string> {
  const set = new Set<string>();
  for (const iso of isoDates) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    // 用本地时区的日历日，避免 UTC 切日把「昨晚写的」算到前一天
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    set.add(key);
  }
  return set;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface WritingStreak {
  /** 当前连续天数（含今天/昨天为锚点向前连续计） */
  current: number;
  /** 今天是否已发布过成文 */
  publishedToday: boolean;
}

/**
 * 计算写作 streak。
 * 规则：
 * - 若今天有发布 → 从今天往前数连续有发布的天数。
 * - 若今天没发布但昨天有 → streak 仍从昨天往前数（今天还来得及续上，不算断）。
 * - 若今天和昨天都没有 → streak 归零。
 */
export function computeWritingStreak(
  publishDates: string[],
  now: Date = new Date(),
): WritingStreak {
  const days = toDaySet(publishDates);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dayKey(today);
  const publishedToday = days.has(todayKey);

  // 选定锚点：今天有则从今天，否则若昨天有则从昨天，否则 streak=0
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let cursor: Date;
  if (publishedToday) {
    cursor = today;
  } else if (days.has(dayKey(yesterday))) {
    cursor = yesterday;
  } else {
    return { current: 0, publishedToday: false };
  }

  let count = 0;
  // 从锚点往前逐日检查是否连续
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current: count, publishedToday };
}
