"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Pencil, Search, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";

const ITEMS = [
  { href: "/", key: "dashboard", icon: Home },
  { href: "/gaps", key: "gaps", icon: Search },
  { href: "/library", key: "library", icon: BookOpen },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      {/* 桌面端：左侧导航 */}
      <nav
        data-el="app-nav-desktop"
        className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border md:bg-card/60 md:px-3 md:py-6"
      >
        <div className="mb-4 px-2">
          <div className="zz-serif text-2xl font-bold leading-none text-primary">{t("brand.cn")}</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("brand.name")}
          </div>
        </div>
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              data-el={`nav-${key}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/70 hover:bg-primary/8 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
        <div className="mt-auto flex items-center gap-1.5 rounded-md border border-border bg-accent/8 px-3 py-2">
          <Pencil className="h-3.5 w-3.5 text-accent" aria-hidden />
          <span className="text-[11px] leading-tight text-muted-foreground">{t("brand.tagline")}</span>
        </div>
      </nav>

      {/* 移动端：底部 Tab */}
      <nav
        data-el="app-nav-mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))" }}
      >
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              data-el={`nav-mobile-${key}`}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-accent")} aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
