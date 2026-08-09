import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter, Noto_Serif_SC } from "next/font/google";
import { cn } from "@/utils/utils";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSyncEffect } from "@/components/i18n/locale-sync-effect";
import { getServerLocale } from "@/lib/i18n/server-preference";

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
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <LocaleSyncEffect />
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
