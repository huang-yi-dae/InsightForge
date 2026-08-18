import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter, Noto_Serif_SC } from "next/font/google";
import { cn } from "@/utils/utils";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { ZhizhiProvider } from "@/lib/zhizhi/store";
import { LocaleSyncEffect } from "@/components/i18n/locale-sync-effect";
import { getServerLocale } from "@/lib/i18n/server-preference";
import { PreviewInspector } from "@/components/eazo/preview-inspector";

// Eazo Creator 预览点选/评论桥：仅在预览环境（平台注入 NEXT_PUBLIC_EAZO_INSPECTOR=1）挂载，
// 生产/桌面构建为 0 时完全不渲染，零成本。
const INSPECTOR_ENABLED = process.env.NEXT_PUBLIC_EAZO_INSPECTOR === "1";

// 桌面端（Tauri 静态导出）兜底：动态详情页（/library/[id]、/write/[id]）只预生成了占位壳，
// 真实 id 目录在 out/ 里不存在。当 Tauri 在深层 URL（如 /library/abc/）下渲染 SPA 兜底页时，
// 文档基准 URL 变深会让部分资源/链接解析错位、样式丢失。注入 <base href="/"> 把所有解析
// 强制锚定到站点根，彻底消除深链页样式丢失。仅桌面构建注入，网页版不受影响。
const IS_DESKTOP = process.env.NEXT_PUBLIC_DESKTOP === "1";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-serif",
});

const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const SITE_TITLE = process.env.NEXT_PUBLIC_APP_TITLE?.trim() || "织知 InsightForge";
const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "个人知识库驱动的反代写写作引擎：AI 只给骨架，血肉由你亲手补。";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("h-full antialiased", "font-sans", inter.variable, notoSerif.variable)}
    >
      {IS_DESKTOP && (
        <head>
          <base href="/" />
        </head>
      )}
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <LocaleSyncEffect />
          <ZhizhiProvider>{children}</ZhizhiProvider>
          <Toaster />
        </I18nProvider>
        {INSPECTOR_ENABLED && <PreviewInspector />}
      </body>
    </html>
  );
}
