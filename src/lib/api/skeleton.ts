import type { Skeleton } from "@/lib/zhizhi/types";

export interface SkeletonRequest {
  gapTitle: string;
  fragments: string[]; // 支撑碎片内容
}

export interface ExpandRequest {
  gapTitle: string;
  heading: string; // 想展开的骨架小节
  fragments: string[];
}

// 反代写约束：后端只返回提纲/要点结构，绝不返回成段文字
export async function generateSkeleton(body: SkeletonRequest): Promise<Skeleton> {
  const res = await fetch("/api/skeleton", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("skeleton_failed");
  const data = (await res.json()) as { skeleton: Skeleton };
  return data.skeleton;
}

export async function requestExpand(body: ExpandRequest): Promise<string[]> {
  const res = await fetch("/api/skeleton/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("expand_failed");
  const data = (await res.json()) as { bullets: string[] };
  return data.bullets;
}
