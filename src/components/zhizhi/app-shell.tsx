"use client";

import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ZhizhiProvider, useZhizhi } from "@/lib/zhizhi/store";
import { aiRatio } from "@/lib/zhizhi/types";
import { AIQuotaMeter } from "./ai-quota-meter";
import { AppNav } from "./app-nav";

function TopBar() {
  const { t } = useTranslation();
  const { drafts, guardrails } = useZhizhi();
  // 顶栏 AI 占比：取所有在写草稿的整体占比
  const totals = drafts
    .filter((d) => d.status === "drafting")
    .reduce((acc, d) => ({ u: acc.u + d.userWords, a: acc.a + d.aiWords }), { u: 0, a: 0 });
  const ratio = aiRatio(totals.u, totals.a);

  return (
    <header
      data-el="app-topbar"
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-6"
      style={{
        paddingTop: "max(10px, env(safe-area-inset-top, 0px))",
        paddingBottom: "10px",
      }}
    >
      <div className="flex items-baseline gap-2 md:hidden">
        <span className="zz-serif text-xl font-bold text-primary">{t("brand.cn")}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <AIQuotaMeter ratio={ratio} limit={guardrails.aiRatioLimit} compact />
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ZhizhiProvider>
      <div className="flex min-h-dvh w-full">
        <AppNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            data-el="app-main"
            className="min-w-0 flex-1 pb-20 md:pb-6"
          >
            {children}
          </main>
        </div>
      </div>
    </ZhizhiProvider>
  );
}
