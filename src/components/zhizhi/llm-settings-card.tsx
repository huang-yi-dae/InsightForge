"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { KeyRound, Loader2, PlugZap } from "lucide-react";
import { useZhizhi } from "@/lib/zhizhi/store";
import {
  PROVIDER_PRESETS,
  getPreset,
  hasLLMConfig,
  type LLMConfig,
  type LLMProviderId,
} from "@/lib/llm/config";
import { callChat, LLMError } from "@/lib/llm/client";

export function LLMSettingsCard() {
  const { t } = useTranslation();
  const { llmConfig, setLLMConfig } = useZhizhi();
  // 本地草稿，保存时才写入 store（避免每次输入都落 localStorage）
  const [draft, setDraft] = useState<LLMConfig>(llmConfig);
  const [testing, setTesting] = useState(false);

  const onProvider = (id: LLMProviderId) => {
    const preset = getPreset(id);
    setDraft((d) => ({
      ...d,
      provider: id,
      // 切换到预设供应商时自动填 base 与建议模型；custom 保留用户已填内容
      baseUrl: id === "custom" ? d.baseUrl : preset.baseUrl,
      model: id === "custom" ? d.model : preset.models[0] ?? d.model,
    }));
  };

  const save = () => {
    setLLMConfig(draft);
    toast.success(t("settings.llmSaved"));
  };

  const test = async () => {
    if (!hasLLMConfig(draft)) {
      toast.error(t("settings.llmIncomplete"));
      return;
    }
    setTesting(true);
    try {
      const res = await callChat(draft, {
        messages: [{ role: "user", content: "ping — reply with the single word: pong" }],
        temperature: 0,
      });
      const text = res.choices[0]?.message?.content ?? "";
      if (text.trim()) toast.success(t("settings.llmTestOk"));
      else toast.error(t("settings.llmTestEmpty"));
    } catch (e) {
      // 分类反馈：跨域是 BYOK 直连最常见的坑，单独给出可行动的说明。
      if (e instanceof LLMError && e.kind === "cors") {
        toast.error(t("settings.llmTestCors"));
      } else if (e instanceof LLMError && e.kind === "auth") {
        toast.error(t("settings.llmTestAuth"));
      } else {
        toast.error(t("settings.llmTestFail", { msg: (e as Error).message.slice(0, 120) }));
      }
    } finally {
      setTesting(false);
    }
  };

  const preset = getPreset(draft.provider);
  const configured = hasLLMConfig(llmConfig);

  return (
    <div data-el="settings-llm" className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent" />
        <div className="font-medium text-foreground">{t("settings.llmTitle")}</div>
        <span
          className={
            configured
              ? "ml-auto rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent"
              : "ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
          }
        >
          {configured ? t("settings.llmOn") : t("settings.llmOff")}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.llmDesc")}</p>

      <div className="mt-4 space-y-3">
        {/* 供应商 */}
        <label className="block">
          <span className="text-xs font-medium text-foreground/70">{t("settings.llmProvider")}</span>
          <select
            data-el="settings-llm-provider"
            value={draft.provider}
            onChange={(e) => onProvider(e.target.value as LLMProviderId)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
          >
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {/* Base URL */}
        <label className="block">
          <span className="text-xs font-medium text-foreground/70">{t("settings.llmBaseUrl")}</span>
          <input
            data-el="settings-llm-baseurl"
            value={draft.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
          />
        </label>

        {/* API Key */}
        <label className="block">
          <span className="text-xs font-medium text-foreground/70">{t("settings.llmApiKey")}</span>
          <input
            data-el="settings-llm-apikey"
            type="password"
            value={draft.apiKey}
            placeholder="sk-…"
            autoComplete="off"
            onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">{t("settings.llmKeyHint")}</span>
        </label>

        {/* Model */}
        <label className="block">
          <span className="text-xs font-medium text-foreground/70">{t("settings.llmModel")}</span>
          <input
            data-el="settings-llm-model"
            value={draft.model}
            placeholder="gpt-4o-mini"
            list="llm-model-suggestions"
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
          />
          <datalist id="llm-model-suggestions">
            {preset.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            data-el="settings-llm-save"
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {t("settings.llmSave")}
          </button>
          <button
            data-el="settings-llm-test"
            onClick={test}
            disabled={testing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            {t("settings.llmTest")}
          </button>
        </div>
      </div>
    </div>
  );
}
