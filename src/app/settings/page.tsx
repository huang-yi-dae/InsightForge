"use client";

import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/zhizhi/app-shell";
import { LLMSettingsCard } from "@/components/zhizhi/llm-settings-card";
import { IdentityMemoryCard } from "@/components/zhizhi/identity-memory-card";
import { useZhizhi } from "@/lib/zhizhi/store";

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsInner() {
  const { t } = useTranslation();
  const { guardrails, setGuardrails, identity, setIdentity } = useZhizhi();

  const identityFields = [
    { key: "pointOfView" as const, label: t("settings.idPov"), ph: t("settings.idPovPh") },
    { key: "audience" as const, label: t("settings.idAudience"), ph: t("settings.idAudiencePh") },
    { key: "voice" as const, label: t("settings.idVoice"), ph: t("settings.idVoicePh") },
    { key: "topics" as const, label: t("settings.idTopics"), ph: t("settings.idTopicsPh") },
  ];

  return (
    <div data-el="settings" className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="zz-serif text-2xl font-bold text-foreground md:text-3xl">{t("settings.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("settings.subtitle")}</p>

      {/* 创作者身份档案 */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="font-medium text-foreground">{t("settings.identityTitle")}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{t("settings.identityDesc")}</div>
        <div className="mt-4 space-y-3">
          {identityFields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs font-medium text-foreground/70">{f.label}</span>
              <textarea
                data-el={`settings-identity-${f.key}`}
                value={identity[f.key]}
                placeholder={f.ph}
                onChange={(e) => setIdentity({ [f.key]: e.target.value })}
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60"
              />
            </label>
          ))}
        </div>
      </div>

      {/* AI 记忆机制：从成文观察，提议增量更新身份档案 */}
      <IdentityMemoryCard />

      {/* AI 模型来源（BYOK：自选供应商 + Key + 模型） */}
      <LLMSettingsCard />

      <div className="mt-3 space-y-3">
        <Row label={t("settings.aiRatio")} desc={t("settings.aiRatioDesc")}>
          <div className="flex items-center gap-3">
            <input
              data-el="settings-ai-ratio"
              type="range"
              min={10}
              max={60}
              step={5}
              value={Math.round(guardrails.aiRatioLimit * 100)}
              onChange={(e) => {
                setGuardrails({ aiRatioLimit: Number(e.target.value) / 100 });
              }}
              onMouseUp={() => toast.success(t("settings.saved"))}
              className="accent-[var(--accent)]"
            />
            <span className="w-10 text-right text-sm font-semibold tabular-nums text-primary">
              {Math.round(guardrails.aiRatioLimit * 100)}%
            </span>
          </div>
        </Row>

        <Row label={t("settings.expandLimit")} desc={t("settings.expandLimitDesc")}>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 5].map((n) => (
              <button
                key={n}
                data-el="settings-expand-limit"
                onClick={() => {
                  setGuardrails({ expandLimit: n });
                  toast.success(t("settings.saved"));
                }}
                className={
                  guardrails.expandLimit === n
                    ? "h-9 w-9 rounded-md bg-primary text-sm font-semibold text-primary-foreground"
                    : "h-9 w-9 rounded-md border border-border bg-card text-sm text-foreground/70"
                }
              >
                {n}
              </button>
            ))}
          </div>
        </Row>

        <Row label={t("settings.dailyInflow")} desc={t("settings.dailyInflowDesc")}>
          <div className="flex items-center gap-3">
            <input
              data-el="settings-daily-inflow"
              type="range"
              min={5}
              max={50}
              step={5}
              value={guardrails.dailyInflowLimit}
              onChange={(e) => setGuardrails({ dailyInflowLimit: Number(e.target.value) })}
              onMouseUp={() => toast.success(t("settings.saved"))}
              className="accent-[var(--accent)]"
            />
            <span className="w-10 text-right text-sm font-semibold tabular-nums text-primary">
              {guardrails.dailyInflowLimit}
            </span>
          </div>
        </Row>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsInner />
    </AppShell>
  );
}
