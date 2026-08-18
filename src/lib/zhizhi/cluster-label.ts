import type { TFunction } from "i18next";

// 「未归类 / 收集箱」簇的稳定 id 与 label 哨兵值。
// 数据层（store）只存哨兵，展示层用 clusterLabel() 翻译成当前语言，
// 避免把中文文案硬编码进数据、破坏 i18n（见 CONTEXT.md §七）。
export const UNCATEGORIZED_CLUSTER_ID = "c-uncat";
export const UNCATEGORIZED_LABEL_SENTINEL = "@uncategorized";

/** 把簇 label 转成可展示文案：哨兵 → 当前语言的「未归类」，其余原样返回。 */
export function clusterLabel(label: string, t: TFunction): string {
  if (label === UNCATEGORIZED_LABEL_SENTINEL) return t("cluster.uncategorized");
  return label;
}
