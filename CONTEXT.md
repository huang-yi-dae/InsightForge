# CONTEXT.md — 织知 InsightForge 领域词典（Ubiquitous Language）

> 这份文档是人和 agent 共用的「共享语言」。代码里的变量/函数/文件命名、对话里的措辞，都应该从这里的术语派生。
> 一句话讲清产品：**个人知识库驱动的反代写写作引擎——AI 只给骨架，血肉由你亲手补。**

---

## 一、核心飞轮（一句话记住产品）

```
碎片 → 归簇 → 发现空白 → 生成骨架 → 写作补血肉 → 发布回流 → 让下次发现更准
Fragment → Cluster → Gap → Skeleton → Draft → Writing → Reflow
```

产品做三件市面工具不做的事：

1. **空白勘探**：告诉你知识库里「该写什么」（素材已齐、却还没写过的点）。
2. **反代写约束**：AI 只产出只读的提纲骨架/要点，绝不写成段正文；画布实时统计「你的字数 vs AI 字数」，超阈值告警。
3. **回流飞轮**：写完发布，成文回流进知识库，下次勘探更准。

---

## 二、领域名词（Nouns）

| 术语（中） | 代码符号 | 定义 | 关键点 |
| --- | --- | --- | --- |
| **碎片** | `Fragment` | 知识库里的最小单位：一条摘录/日记/想法。有 `content`、所属 `clusterId`、`source`、`createdAt`。 | `reflowed=true` 表示被某篇成文引用「盘活」过。 |
| **簇** | `Cluster` | 一组同主题碎片的聚合，有 `label`（主题标签）与 `fragmentIds`。 | 未匹配到任何簇的导入碎片落到 `c-uncat`「未归类/收集箱」。 |
| **空白** | `Gap` | 「该写却还没写」的选题。有 `title`、`confidence`(0-1)、相邻 `clusterIds`、`supportingFragmentIds`、`status`。 | `status`: `todo`→`drafting`→`published`。AI 发现的空白带 `aiReason`。 |
| **骨架** | `Skeleton` | AI 为某个空白生成的**只读**提纲：若干 `SkeletonPoint{heading, bullets}`。 | 铁律：只出要点，**绝不出成段文字**，不可整段插入画布。 |
| **草稿** | `Draft` | 针对一个空白的在写文章。含 `content`（你写的正文）、`userWords`/`aiWords`、`expandUses`、`citedFragmentIds`。 | 一个空白同一时刻最多一个 `drafting` 草稿。 |
| **成文** | `Writing` | 已发布的草稿快照。发布后触发回流。 | 计入成文库 `/library`。 |
| **护栏** | `Guardrails` | 反代写阈值：`aiRatioLimit`(默认 0.3)、`expandLimit`(默认 3)、`dailyInflowLimit`(默认 20)。 | 在 `/settings` 调整。 |
| **创作者身份档案** | `Identity` | `pointOfView / audience / voice / topics`。生成骨架/发现选题时注入，让产出「像你」。 | 借鉴 Eden，但**只影响提纲取向，绝不代写**。 |
| **选题理由** | `GapReason` / `aiReason` | 「为什么先写这个」的依据。本地启发式给结构化 `GapReason`；AI 发现给一句 `aiReason`。 | `GapReason` 返回 i18n key，不硬编码文案。 |

---

## 三、领域动作（Verbs）

| 术语（中） | 代码符号 | 含义 |
| --- | --- | --- |
| **导入存量内容** | `importContent(text)` | 把长文本（日记/摘抄/旧文/上传 .txt·.md）按段落切成碎片入库，自动归到最匹配的簇。 |
| **快速采集** | `captureFragment(content)` | 随手存一条碎片，自动归簇。 |
| **发现空白（本地）** | `discoverNewGaps(limit)` | 纯本地启发式：按碎片密度+新鲜度打分、去重，从存量内容找出可写空白。零依赖、无需 Key。 |
| **发现空白（AI）** | `discoverNewGapsAI(limit)` | 优先走 `/api/discover`，AI 读碎片归纳主题并给出带理由的选题；**失败/无 Key/超时/结果被去重时自动回退** `discoverNewGaps`。 |
| **生成骨架** | `/api/skeleton` | AI 为空白产出只读提纲（受"只出提纲"硬约束）。 |
| **请求展开** | `expandSkeleton` | 对骨架某点请求更多要点提示，计入 `aiWords` 与 `expandUses`（受 `expandLimit` 限制）。 |
| **引用碎片** | `citeFragment` | 在草稿里引用某碎片，标记其 `reflowed`。 |
| **发布并回流** | `publishDraft` | 草稿→成文，被引用的碎片标记盘活（回流）。 |
| **成文导出** | `export.ts` | 把成文复制为 Markdown / 下载 .md。 |

---

## 四、AI 与降级策略（重要约束）

- **AI 来源**：项目自部署，用 **BYOK / OpenAI 兼容 API**（`OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`），可接 DeepSeek、StepFun 等。**不使用 Eazo App AI 计费**（本项目无该配置，详见 ADR）。
- **统一降级铁律**：任何 AI 能力在**未配 Key / 请求失败 / 超时**时，都必须**优雅回退**到本地可用行为，App 始终可用：
  - 生成骨架失败 → 前端预置骨架（`/api/skeleton` 返回 503 `llm_unavailable`）。
  - AI 发现失败 → 本地启发式发现（`/api/discover` 返回 503，客户端 `discoverNewGapsAI` 回退 `discoverNewGaps`）。
- **反代写铁律**：AI 永远只出**提纲/要点**，绝不出成段正文；正文字数必须由人写，`aiRatio` 超 `aiRatioLimit` 即告警。

---

## 五、数据与持久化

- **双后端**：配了 `DATABASE_URL`（Postgres，兼容 Neon / Eazo 托管）→ 走数据库（Drizzle ORM，服务端 `/api/kb`）；否则回退浏览器 `localStorage`。
- **水合铁律**：SSR 与客户端首帧必须一致（一律用 seed 数据、`ready=false`），localStorage/DB 读取只在客户端 `useEffect` 里做——否则 hydration 不匹配会导致**页面显示正常但点不动**（历史踩过的坑）。

---

## 六、页面地图

| 路由 | 名称 | 职责 |
| --- | --- | --- |
| `/` | 今日总览 | 今日流入 / 待办空白 / 在写草稿（统计卡可点击跳转）+ 推荐先写 |
| `/gaps` | 空白勘探 | 碎片场 → 空白列表 → 详情；「导入存量内容」+「帮我找灵感」(AI 发现) |
| `/write/[id]` | 写作画布 | 三栏：AI 只读骨架 / 你的留白正文 / 相关碎片；字数护栏 + 请求展开 + 发布回流 |
| `/library` | 成文库 | 已发布成文 + 回流状态 + 人工字占比 + Markdown 导出 |
| `/settings` | 设置 | 护栏阈值 + 创作者身份档案 |

---

## 七、命名约定

- 用户可见文案**一律走 i18n**（`react-i18next`，`zh-CN`/`en-US`），禁止硬编码；纯函数返回 i18n key 而非文案。
- 交互元素带 `data-el="..."` 便于定位与测试。
- 服务端 AI 客户端（`@/lib/llm/client`）**绝不**在 `"use client"` 文件里 import。
