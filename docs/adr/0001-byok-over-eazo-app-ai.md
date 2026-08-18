# ADR 0001：AI 走 BYOK / OpenAI 兼容，而非 Eazo App AI 计费

- 状态：已采纳
- 日期：2026-08-09

## 背景

「织知」需要两处 AI 能力：生成骨架（`/api/skeleton`）与发现可写点（`/api/discover`）。
平台侧提供了「Eazo App AI 计费代理」（viewer 用量计到创作者 Credits）作为一种接入方式。

## 决策

**继续使用项目既有的 BYOK / OpenAI 兼容客户端**（`@/lib/llm/client`，读 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`），**不引入 Eazo App AI 计费路径。**

## 理由

1. **本项目是自部署 + 自带数据库（Neon/Postgres）架构**，没有 Eazo App AI 的环境配置（`EAZO_APP_AI_API_BASE` / `EAZO_APP_ID` / `EAZO_PRIVATE_KEY` 等均不存在）。
2. **一致性**：既有的 `/api/skeleton` 已用这套 BYOK 客户端，`/api/discover` 沿用同一机制，降级语义统一（无 Key → 503 → 本地回退）。
3. **可移植**：部署到 Vercel/任意平台只需配一个 OpenAI 兼容 Key，不绑定 Eazo。
4. **降级友好**：无 Key 时 App 仍完全可用（骨架走预置、发现走本地启发式）。

## 影响 / 权衡

- ✅ 部署简单、无平台锁定、离线可用。
- ⚠️ viewer 用量不经过 Eazo 计费，需创作者自己承担 API 成本。
- ⚠️ 若将来要在 Eazo 市场按 viewer 计费分发，需另评估切换到 App AI 路径。

## 相关

- `src/lib/llm/client.ts`、`src/app/api/skeleton/route.ts`、`src/app/api/discover/route.ts`
- `CONTEXT.md` §四 AI 与降级策略
