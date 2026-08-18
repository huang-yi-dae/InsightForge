import type { Cluster, Draft, Fragment, Gap, Writing } from "./types";

// 织知内置示例知识库（本地演示版的真实领域内容）。
// 主题取自真实痛点：系统建设输入黑洞、Vibe-coding 收获感悖论、多工具上下文混乱、收获感追踪等。
// 这不是占位数据，而是让用户第一眼就能跑通「反代写飞轮」的种子知识库。

export const SEED_CLUSTERS: Cluster[] = [
  { id: "c-tool", label: "多工具协作流", fragmentIds: ["f1", "f2", "f3", "f7"] },
  { id: "c-vibe", label: "Vibe-coding 与参与感", fragmentIds: ["f4", "f5", "f10"] },
  { id: "c-input", label: "输入黑洞 / 收集病", fragmentIds: ["f6", "f8", "f11"] },
  { id: "c-track", label: "收获感与复盘", fragmentIds: ["f9", "f12", "f13"] },
];

export const SEED_FRAGMENTS: Fragment[] = [
  { id: "f1", clusterId: "c-tool", source: "flomo", content: "同时开着 Claude、Cursor、Notion、飞书，上下文在四个窗口里来回跳，经常忘了刚才那个想法是在哪个工具里。", createdAt: "2026-08-01T09:12:00Z" },
  { id: "f2", clusterId: "c-tool", source: "flomo", content: "工具越多，切换成本越高，真正「进入心流」的时间反而变少了。", createdAt: "2026-08-02T14:30:00Z" },
  { id: "f3", clusterId: "c-tool", source: "para", content: "隔离原则：每个工具只承担一件事，输入口收敛到一个 Inbox，避免多头收集。", createdAt: "2026-08-03T20:05:00Z" },
  { id: "f4", clusterId: "c-vibe", source: "flomo", content: "AI 帮我写完整篇后，我反而有种「这不是我写的」的空虚感——收获感悖论。", createdAt: "2026-08-01T22:41:00Z" },
  { id: "f5", clusterId: "c-vibe", source: "raw", content: "作品里要「有我」：AI 可以给脚手架，但血肉、判断、语气必须是自己的。", createdAt: "2026-08-04T08:15:00Z" },
  { id: "f6", clusterId: "c-input", source: "para", content: "02_Building 已经攒了 422 篇，但真正被再次打开、被引用的不到 5%。", createdAt: "2026-08-02T11:00:00Z" },
  { id: "f7", clusterId: "c-tool", source: "flomo", content: "把「上下文」显式写下来（当前目标 / 手头文件 / 下一步），切工具前先存一份，能省很多找回成本。", createdAt: "2026-08-05T16:20:00Z" },
  { id: "f8", clusterId: "c-input", source: "flomo", content: "收集像多巴胺：存下来那一刻很爽，但存完就再也不看了。", createdAt: "2026-08-03T09:50:00Z" },
  { id: "f9", clusterId: "c-track", source: "raw", content: "想给自己做一个「收获感追踪」：每周记录真正产出了什么，而不是收集了多少。", createdAt: "2026-08-04T21:30:00Z" },
  { id: "f10", clusterId: "c-vibe", source: "para", content: "多线程收集器 → 单线程创造者：真正稀缺的是把收集强制转成产出的那个装置。", createdAt: "2026-08-05T10:10:00Z" },
  { id: "f11", clusterId: "c-input", source: "flomo", content: "给每日碎片流入设个上限，超了就提醒『先去写一篇再收集』。", createdAt: "2026-08-06T13:00:00Z" },
  { id: "f12", clusterId: "c-track", source: "flomo", content: "周报机制其实已经在手工做「碎片→成文」，但全靠人肉整理，太累。", createdAt: "2026-08-06T19:45:00Z" },
  { id: "f13", clusterId: "c-track", source: "raw", content: "衡量真实参与感的指标：一篇里『我写的字』占比越高越安心。", createdAt: "2026-08-07T07:20:00Z" },
];

export const SEED_GAPS: Gap[] = [
  {
    id: "gap-tool-context",
    title: "多工具上下文混乱：如何显式管理心流",
    confidence: 0.86,
    clusterIds: ["c-tool"],
    supportingFragmentIds: ["f1", "f2", "f3", "f7"],
    status: "todo",
  },
  {
    id: "gap-vibe-me",
    title: "Vibe-coding 收获感悖论：作品里如何『有我』",
    confidence: 0.79,
    clusterIds: ["c-vibe"],
    supportingFragmentIds: ["f4", "f5", "f10"],
    status: "todo",
  },
  {
    id: "gap-input-blackhole",
    title: "收集黑洞：从多头收集到单一 Inbox",
    confidence: 0.74,
    clusterIds: ["c-input", "c-tool"],
    supportingFragmentIds: ["f6", "f8", "f11", "f3"],
    status: "todo",
  },
  {
    id: "gap-harvest-track",
    title: "收获感追踪：用产出而非收集来衡量自己",
    confidence: 0.71,
    clusterIds: ["c-track"],
    supportingFragmentIds: ["f9", "f12", "f13"],
    status: "drafting",
    draftId: "draft-harvest",
  },
];

// 预置一篇在写草稿（首屏落在画布内即用它）
export const SEED_DRAFTS: Draft[] = [
  {
    id: "draft-harvest",
    gapId: "gap-harvest-track",
    title: "收获感追踪：用产出而非收集来衡量自己",
    content:
      "过去一年我最大的错觉，是把「收集了多少」当成了「成长了多少」。收藏夹越来越满，可真正回流到我脑子里、变成能用的东西的，寥寥无几。",
    skeleton: {
      generatedAt: "2026-08-07T10:00:00Z",
      points: [
        { heading: "现象：收集的快感", bullets: ["存下即满足", "422 篇 vs 使用率 <5%"] },
        { heading: "为什么收集≠成长", bullets: ["缺少产出回流", "没有被再次引用的资产等于闲置"] },
        { heading: "一个可操作的指标", bullets: ["每周成文数", "人工字占比", "被盘活的碎片数"] },
      ],
    },
    userWords: 62,
    aiWords: 0,
    expandUses: 0,
    citedFragmentIds: ["f9"],
    updatedAt: "2026-08-07T10:30:00Z",
    status: "drafting",
  },
];

// 预置一篇已发布并回流的成文
export const SEED_WRITINGS: Writing[] = [
  {
    id: "w-flow",
    draftId: "draft-flow",
    gapId: "gap-old-flow",
    title: "把心流写下来：切工具前先存一份上下文",
    content:
      "我给自己定了一条规矩：每次要切换工具之前，先花三十秒把当前上下文写下来——我在做什么、手头是哪个文件、下一步要干嘛。听起来啰嗦，但它把「找回上一个想法」的成本几乎降到了零……",
    userWords: 486,
    aiWords: 112,
    publishedAt: "2026-08-05T18:00:00Z",
    reflowed: true,
  },
];
