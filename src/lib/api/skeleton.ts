import { request } from "@/lib/api/request";
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
  const res = await request<{ skeleton: Skeleton }>("/api/skeleton", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.skeleton;
}

export async function requestExpand(body: ExpandRequest): Promise<string[]> {
  const res = await request<{ bullets: string[] }>("/api/skeleton/expand", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.bullets;
}
