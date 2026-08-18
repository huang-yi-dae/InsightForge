import { WritePageClient } from "./client";

// 静态导出（桌面端）需要预生成路径。真实 draftId 存于浏览器本地，
// 服务端无从枚举，因此仅导出一个占位壳；实际导航由客户端路由完成。
export function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default async function WritePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WritePageClient id={id} />;
}
