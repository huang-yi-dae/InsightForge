import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Skeleton } from "@/lib/zhizhi/types";

// 织知知识库表（无登录、单一共享库）。兼容任意 Postgres（含 Neon）。

export const clusters = pgTable("clusters", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  fragmentIds: jsonb("fragment_ids").$type<string[]>().notNull().default([]),
});

export const fragments = pgTable("fragments", {
  id: text("id").primaryKey(),
  clusterId: text("cluster_id").notNull(),
  source: text("source").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reflowed: boolean("reflowed").notNull().default(false),
});

export const gaps = pgTable("gaps", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  confidence: real("confidence").notNull().default(0),
  clusterIds: jsonb("cluster_ids").$type<string[]>().notNull().default([]),
  supportingFragmentIds: jsonb("supporting_fragment_ids").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("todo"),
  draftId: text("draft_id"),
});

export const drafts = pgTable("drafts", {
  id: text("id").primaryKey(),
  gapId: text("gap_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  skeleton: jsonb("skeleton").$type<Skeleton | null>(),
  userWords: integer("user_words").notNull().default(0),
  aiWords: integer("ai_words").notNull().default(0),
  expandUses: integer("expand_uses").notNull().default(0),
  citedFragmentIds: jsonb("cited_fragment_ids").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("drafting"),
});

export const writings = pgTable("writings", {
  id: text("id").primaryKey(),
  draftId: text("draft_id").notNull(),
  gapId: text("gap_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  userWords: integer("user_words").notNull().default(0),
  aiWords: integer("ai_words").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  reflowed: boolean("reflowed").notNull().default(true),
});

// 单行设置表（反代写护栏 + 创作者身份档案）。id 固定为 "default"。
export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  aiRatioLimit: real("ai_ratio_limit").notNull().default(0.3),
  expandLimit: integer("expand_limit").notNull().default(3),
  dailyInflowLimit: integer("daily_inflow_limit").notNull().default(20),
  // 身份档案（Identity）
  identityPov: text("identity_pov").notNull().default(""),
  identityAudience: text("identity_audience").notNull().default(""),
  identityVoice: text("identity_voice").notNull().default(""),
  identityTopics: text("identity_topics").notNull().default(""),
});
