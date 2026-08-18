# 安全说明 / Security Notes

本文件记录 InsightForge / 织知 的安全审查基线与已接受风险，便于审计留痕。
最近审查：多轮静态安全审查（密钥、危险 API、注入面、SSRF、依赖、错误泄露、输入边界）。

## 当前基线

| 维度 | 状态 |
|---|---|
| 硬编码密钥 / 凭证 | ✅ 无（API key 仅走 `process.env` 服务端或浏览器 localStorage，绝不入共享 DB / 日志） |
| 危险 API（eval / dangerouslySetInnerHTML / innerHTML / document.write） | ✅ 无 |
| 抑制标记（@ts-ignore / eslint-disable） | ✅ 无 |
| SQL 注入面 | ✅ 无（DB 层全用类型化 drizzle 查询，无原始 SQL / 模板拼接） |
| 错误信息泄露 | ✅ 无（`error.tsx` 仅在 `NODE_ENV==='development'` 显示详情，生产只给通用文案） |
| 运行时高危依赖 | ✅ 无（`next` 已升至 16.3.0，清除 SSRF / 图片优化 DoS / Server Function 泄露及 postcss/sharp 高危） |
| 依赖审计（npm audit） | ✅ **0 vulnerabilities**（移除 drizzle-kit CLI 依赖后，废弃 @esbuild-kit 链一并消除） |
| 代转路由滥用防护 | ✅ 有（三条 LLM 代转路由按 IP 滑动窗口限流，20 次/分，超限 429+Retry-After） |

## 已实施的加固

- **BYOK 服务端代转 SSRF 防护**：`sanitizeIncomingConfig`（`src/lib/llm/config.ts`）在协议白名单之外，
  用 `isBlockedHost` 拦截环回、link-local / 云元数据（169.254.169.254）、RFC1918 私网、IPv6 本地地址、
  以及 `.internal/.local/.lan` 后缀。附 9 个单元测试（`src/lib/llm/config.test.ts`）。
- **代转路由输入边界统一**：`/api/discover`、`/api/skeleton`、`/api/skeleton/expand` 对所有用户可控字段做
  类型校验 + 长度截断（标题 300、identity 800、单条 fragment 2000、数组限量），防止无界文本流入 prompt。
- **密钥零留存**：代转路由的 BYOK key 仅在单次请求内存中使用、用完即弃，绝不落盘 / 写日志。
- **代转路由速率限制（开放代理滥用防护）**：`/api/discover`、`/api/skeleton`、`/api/skeleton/expand`
  在入口按客户端 IP（`x-forwarded-for` 首段 / `x-real-ip`，缺失则回退全局桶）做滑动窗口限流，
  默认 **每 IP 每分钟 20 次**，超限返回 `429` + `Retry-After`。实现见 `src/lib/api/rate-limit.ts`
  （零依赖内存滑动窗口，含惰性过期清理与 Map 上限保护），附 9 个单元测试
  （`src/lib/api/rate-limit.test.ts`）。**局限**：内存计数不跨 serverless 实例共享，属「尽力而为的
  成本护栏」而非强一致配额；横向扩容需强配额时可无缝替换为 Redis/Upstash（接口不变）。

## 已解决：移除 drizzle-kit CLI 依赖（原 4 个 moderate 已清零）

早前版本依赖 `drizzle-kit@0.31.10`（devDep），其通过废弃的 `@esbuild-kit/*` 深层锁死
`esbuild@0.18.20`，触发 4 个 moderate（esbuild dev-server advisory GHSA-67mh-4wv8-2f99）。
由于该包已废弃且将 esbuild 锁为精确版本，`overrides`（顶层与嵌套均实测）无法穿透。

**解决方案**（零数据层风险）：
- 移除 `drizzle-kit` devDependency（`npm audit` 随之归零）。
- `db:migrate` 改用 `scripts/db-migrate.mjs`，基于已在依赖中、无漏洞的
  `drizzle-orm/postgres-js/migrator` 应用仓库已生成的迁移（`src/lib/db/migrations/`）。
  运行时 DB 客户端本就用 `drizzle-orm/postgres-js`，能力等价、DDL 零改动、无脱节风险。
- 生成新迁移的 `db:generate` / `db:push` 改为按需 `npx --yes drizzle-kit@^0.31`（开发期一次性
  操作），不再进入 `bun.lock` / `node_modules` / 审计树。

验证：`npm audit` = **0 vulnerabilities**；migrator 可导入；24/24 测试、lint 0/0、web build、
桌面静态导出均绿。
