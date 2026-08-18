// 写作度量：把「已发布成文」聚合成可视化数据——近 7 日字数柱状 + 成就徽章。
// 呼应织知「用产出倒逼输入」：度量的是真正写完发布的产出，而非收集量。
// 纯函数 + 可注入 now，便于测试与 SSR 一致。

import type { Writing } from "./types";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DayBar {
  key: string; // YYYY-MM-DD
  label: string; // 周几简写（本地）
  words: number; // 当日发布成文的总字数（user+ai）
  isToday: boolean;
}

/** 近 N 天（默认 7）每日发布字数序列，用于柱状图。最早在前、今天在末。 */
export function weeklyWordSeries(writings: Writing[], now: Date = new Date(), days = 7): DayBar[] {
  const totals = new Map<string, number>();
  for (const w of writings) {
    const d = new Date(w.publishedAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = dayKey(d);
    totals.set(k, (totals.get(k) ?? 0) + (w.userWords ?? 0) + (w.aiWords ?? 0));
  }
  const weekday = ["日", "一", "二", "三", "四", "五", "六"];
  const todayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const out: DayBar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const k = dayKey(d);
    out.push({ key: k, label: weekday[d.getDay()], words: totals.get(k) ?? 0, isToday: k === todayKey });
  }
  return out;
}

export interface Badge {
  id: string;
  earned: boolean;
  /** 达成进度 0..1，用于未解锁徽章的进度显示 */
  progress: number;
}

export interface MetricsInput {
  totalWords: number; // 累计已发布字数
  publishedCount: number; // 已发布成文数
  streak: number; // 当前连续天数
}

/** 计算里程碑徽章。阈值刻意偏低，让早期就有正反馈。 */
export function earnedBadges({ totalWords, publishedCount, streak }: MetricsInput): Badge[] {
  const badge = (id: string, value: number, target: number): Badge => ({
    id,
    earned: value >= target,
    progress: Math.max(0, Math.min(1, value / target)),
  });
  return [
    badge("firstPiece", publishedCount, 1),
    badge("tenPieces", publishedCount, 10),
    badge("streak3", streak, 3),
    badge("streak7", streak, 7),
    badge("words10k", totalWords, 10000),
    badge("words50k", totalWords, 50000),
  ];
}

/** 聚合出度量总量，供徽章与仪表盘共用。 */
export function summarizeWritings(writings: Writing[]): { totalWords: number; publishedCount: number } {
  let totalWords = 0;
  for (const w of writings) totalWords += (w.userWords ?? 0) + (w.aiWords ?? 0);
  return { totalWords, publishedCount: writings.length };
}
