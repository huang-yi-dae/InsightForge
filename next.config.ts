import type { NextConfig } from "next";

// 桌面端（Tauri）构建：DESKTOP=1 时输出纯静态站点到 out/，
// 由 Tauri 以本地文件形式加载，全程 BYOK 前端直连、无需服务端。
// web 构建不设该变量，保留 SSR / API routes 代理能力。
const isDesktop = process.env.DESKTOP === "1";

const nextConfig: NextConfig = {
  // 参考 Tauri 官方 Next.js 模板的最佳实践：开启严格模式，
  // 开发期提前暴露不纯副作用 / effect 清理问题（生产构建不影响行为）。
  reactStrictMode: true,
  // 允许 E2B 沙盒预览域访问 dev 资源（HMR / client chunks）。
  // Next.js 16 默认拦截跨源 dev 资源请求，会导致 client JS 加载失败、
  // React 无法 hydrate，从而按钮点击等交互全部失效。
  allowedDevOrigins: ["*.e2b.app", "localhost"],
  // 桌面导出（Tauri v2）：以 `tauri://localhost/` 为站点根加载，
  // 因此用默认的根绝对资源路径 `/_next/...`（对所有页面深度一致命中）。
  // 切勿用 assetPrefix:"./" 相对前缀——子页面（如 /gaps/）会把 `./_next` 解析
  // 到 /gaps/_next 而 404，导致样式全丢。trailingSlash 保留目录式 URL。
  ...(isDesktop
    ? { output: "export" as const, trailingSlash: true }
    : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
