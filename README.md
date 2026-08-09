# 织知 InsightForge

> 个人知识库驱动的**反代写**写作引擎 —— AI 只给骨架，血肉由你亲手补。

「织知」不替你写，而是做三件市面工具都不做的事：

1. **空白勘探** —— 告诉你知识库里「该写什么」（相邻概念都齐、却还没写过的空白点）。
2. **反代写约束** —— AI 只生成只读的提纲骨架 / 要点，绝不输出成段文字；写作画布实时统计「你的字数 vs AI 字数占比」，超阈值即告警。
3. **回流飞轮** —— 写完发布，成文回流进知识库，下次勘探更准。

## 主闭环

今日总览 → 空白勘探（选一个空白）→ 生成骨架 → 三栏写作画布补血肉 → 发布并回流 → 成文库。

## 页面

- `/` 今日总览：今日流入 / 待办空白 / 在写草稿 + 推荐先写
- `/gaps` 空白勘探：文学双联（碎片场 → 空白列表 → 详情）
- `/write/[id]` 写作画布：三栏（AI 只读骨架 / 你的留白正文 / 相关碎片素材）+ 人工/AI 字数占比护栏 + 请求展开次数上限 + 发布回流
- `/library` 成文库：已发布成文 + 回流状态 + 人工字占比
- `/settings` 设置：反代写护栏阈值（AI 占比上限 / 请求展开次数 / 每日碎片流入上限）

## 技术栈

- Next.js（App Router）+ TypeScript + Tailwind CSS v4 + shadcn/ui
- i18n：`react-i18next`（zh-CN / en-US，默认中文）
- 数据：内置示例知识库 + 浏览器 `localStorage`，无需登录、无需数据库
- AI：直连 **OpenAI 兼容 API**（可接 DeepSeek / OpenAI / 任意兼容服务商），受「只出提纲、不出成段文字」硬约束；未配置密钥时自动回退到前端预置骨架

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
| `OPENAI_API_KEY` | LLM 的 API Key。留空则 AI 回退到前端预置骨架 |
| `OPENAI_BASE_URL` | 兼容服务商 base，默认 `https://api.openai.com/v1`（DeepSeek 用 `https://api.deepseek.com/v1`） |
| `OPENAI_MODEL` | 模型名，默认 `gpt-4o-mini`（DeepSeek 用 `deepseek-chat`） |
| `NEXT_PUBLIC_APP_TITLE` | 应用标题（可选） |
| `NEXT_PUBLIC_APP_DESCRIPTION` | 应用描述（可选） |

## 部署到 Vercel

1. 将本仓库导入 Vercel（框架自动识别为 Next.js）。
2. 在项目 Environment Variables 中填入上表的 `OPENAI_*` 变量（可选，不填则 AI 走预置骨架）。
3. Deploy 即可。仓库不依赖任何外部平台 SDK，是一个纯净的 Next.js 应用。
