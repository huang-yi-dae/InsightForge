# 织知 InsightForge

> 个人知识库驱动的**反代写**写作引擎 —— AI 只给骨架，血肉由你亲手补。

「织知」不替你写，而是做三件市面工具都不做的事：

1. **空白勘探** —— 告诉你知识库里「该写什么」（相邻概念都齐、却还没写过的空白点）。
2. **反代写约束** —— AI 只生成只读的提纲骨架 / 要点，绝不输出成段文字；写作画布实时统计「你的字数 vs AI 字数占比」，超阈值即告警。
3. **回流飞轮** —— 写完发布，成文回流进知识库，下次勘探更准。

> 📖 领域术语 / 共享语言见 [`CONTEXT.md`](./CONTEXT.md)。关键技术决策见 [`docs/adr/`](./docs/adr)。

## 主闭环

```
今日总览 → 空白勘探（导入存量内容 / 帮我找灵感）→ 选一个空白 → 生成骨架
        → 三栏写作画布补血肉 → 发布并回流 → 成文库（可导出 Markdown）
```

## 从哪来内容

- **导入存量内容**：在「空白勘探」页粘贴日记 / 摘抄 / 旧文，或上传 `.txt` / `.md`，按段落切成碎片入库并自动归簇。
- **快速采集**：随手记一条，自动归到最匹配的簇。
- **发现可写点（帮我找灵感）**：
  - 配了 AI Key → 走 AI，读你的碎片归纳主题、给出带理由的选题；
  - 没配 Key / AI 失败 → **自动回退**本地启发式（按碎片密度+新鲜度打分），App 始终可用。

## 页面

- `/` 今日总览：今日流入 / 待办空白 / 在写草稿（统计卡可点击跳转）+ 推荐先写
- `/gaps` 空白勘探：碎片场 → 空白列表 → 详情；顶部有「导入存量内容」与「帮我找灵感」
- `/write/[id]` 写作画布：三栏（AI 只读骨架 / 你的留白正文 / 相关碎片素材）+ 人工/AI 字数占比护栏 + 请求展开次数上限 + 发布回流
- `/library` 成文库：已发布成文 + 回流状态 + 人工字占比 + 复制/下载 Markdown
- `/settings` 设置：反代写护栏阈值（AI 占比上限 / 请求展开次数 / 每日碎片流入上限）+ 创作者身份档案

## 技术栈

- Next.js（App Router）+ TypeScript + Tailwind CSS v4 + shadcn/ui
- i18n：`react-i18next`（zh-CN / en-US，默认中文）
- **数据（双后端，自动降级）**：
  - 配了 `DATABASE_URL`（Postgres，兼容 Neon / Eazo 托管）→ 走数据库（Drizzle ORM，服务端 `/api/kb`）；
  - 未配 → 回退浏览器 `localStorage`（内置示例知识库，无需登录即可体验）。
- **AI（BYOK，自动降级）**：直连 **OpenAI 兼容 API**（可接 DeepSeek / OpenAI / StepFun / 任意兼容服务商），受「只出提纲、不出成段文字」硬约束；未配置密钥时自动回退到前端预置骨架 / 本地启发式发现。

## 本地开发

```bash
bun install       # 或 npm install
bun run dev       # 启动开发服务器 http://localhost:3000
bun run lint
bun run build
```

## 环境变量

复制 `.env.example` 为 `.env`（或在部署平台配置）：

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | LLM 的 API Key。留空则 AI 回退到前端预置骨架 / 本地启发式发现 |
| `OPENAI_BASE_URL` | 兼容服务商 base，默认 `https://api.openai.com/v1`（DeepSeek 用 `https://api.deepseek.com/v1`） |
| `OPENAI_MODEL` | 模型名，默认 `gpt-4o-mini`（DeepSeek 用 `deepseek-chat`） |
| `DATABASE_URL` | Postgres 连接串（兼容 Neon）。留空则数据走浏览器 `localStorage` |
| `MCP_TOKEN` | 启用 `/api/mcp` 知识库 MCP 服务的访问令牌。留空则 MCP 端点整体禁用（需同时配 `DATABASE_URL`） |
| `NEXT_PUBLIC_APP_TITLE` | 应用标题（可选） |
| `NEXT_PUBLIC_APP_DESCRIPTION` | 应用描述（可选） |

## API 路由

- `POST /api/kb`：知识库读写（数据库后端时的持久化）
- `POST /api/skeleton`、`/api/skeleton/expand`：生成/展开骨架（只出提纲）
- `POST /api/discover`：AI 发现可写点（无 Key 返回 503，客户端回退本地启发式）
- `POST /api/mcp`：知识库 MCP 服务（MCP Streamable HTTP）。需配 `MCP_TOKEN` + `DATABASE_URL`；未配令牌时返回 503

## MCP：把知识库接入 AI 客户端

配好 `MCP_TOKEN` 与 `DATABASE_URL` 后，任意支持 MCP 的 AI 客户端（Claude Desktop / Cursor / 自定义 agent）可直接检索你的碎片与成文。当前为只读工具：`search_knowledge`、`list_writings`、`get_writing`、`list_gaps`。

```json
{
  "mcpServers": {
    "zhizhi": {
      "url": "https://<your-app>/api/mcp",
      "headers": { "x-mcp-token": "<MCP_TOKEN>" }
    }
  }
}
```

## 部署到 Vercel

1. 将本仓库导入 Vercel（框架自动识别为 Next.js）。
2. 在项目 Environment Variables 中按上表填入 `OPENAI_*`（可选）与 `DATABASE_URL`（可选）。
3. Deploy 即可。两类外部依赖都可缺省——缺省时 App 自动降级到本地可用状态。

## 开发者辅助：Agent Skills

仓库内置了 [`mattpocock/skills`](https://github.com/mattpocock/skills)（`.agents/` 为源，`.claude/` 供 Claude Code）。
在 Claude Code / Codex 等编码 agent 里可用 `/grill-me`、`/tdd`、`/code-review` 等；更新用 `npx skills update`。
