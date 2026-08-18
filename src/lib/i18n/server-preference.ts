import { cookies } from "next/headers";
import {
  LOCALE_STORAGE_KEY,
  parseLocalePreference,
  resolveLocalePreference,
} from "@/lib/i18n/preference";
import type { LocaleCode } from "@/lib/i18n/locale";

/** Resolved locale for SSR (cookie → default en-US). */
export async function getServerLocale(): Promise<LocaleCode> {
  // 桌面端（静态导出）无服务端 cookie，首屏直接用默认中文；
  // 客户端 LocaleSyncEffect 会在挂载后从 localStorage 同步真实偏好。
  if (process.env.DESKTOP === "1") {
    return "zh-CN";
  }
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_STORAGE_KEY)?.value;
  const preference = parseLocalePreference(
    raw ? decodeURIComponent(raw) : null,
  );
  if (preference === "system") {
    return "en-US";
  }
  return resolveLocalePreference(preference);
}
