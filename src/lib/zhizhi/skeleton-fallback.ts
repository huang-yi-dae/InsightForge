import type { Skeleton } from "./types";

// 前端兜底：当骨架服务不可用时，用支撑碎片拼出一份「只有提纲」的骨架。
// 严格遵守反代写约束：只出提纲/要点，绝不出成段文字。
export function presetSkeleton(gapTitle: string, fragments: string[]): Skeleton {
  const firstClause = (s: string) => s.replace(/[，。,.;；].*$/u, "").slice(0, 18);
  const bullets = fragments.slice(0, 3).map(firstClause).filter(Boolean);
  return {
    generatedAt: new Date().toISOString(),
    points: [
      { heading: "现象：你观察到了什么", bullets: bullets.length ? bullets : ["列出触发这个主题的具体场景"] },
      { heading: "为什么会这样", bullets: ["拆出 2-3 个根因", "找出它们之间的张力"] },
      { heading: "你的主张 / 原则", bullets: ["提出一条可操作的原则", "给一个你自己会用的例子"] },
      { heading: "下一步", bullets: ["读者读完能做的第一件事"] },
    ],
  };
}

// 请求展开兜底：只返回要点提示（bullet），不返回成段文字
export function presetExpand(heading: string): string[] {
  return [
    `围绕「${heading}」先写一句你自己的判断`,
    "补一个只有你才有的具体例子",
    "留一个反问，逼自己想得更深",
  ];
}
