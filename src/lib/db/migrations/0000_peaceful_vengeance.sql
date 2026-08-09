CREATE TABLE "clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"fragment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"gap_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"skeleton" jsonb,
	"user_words" integer DEFAULT 0 NOT NULL,
	"ai_words" integer DEFAULT 0 NOT NULL,
	"expand_uses" integer DEFAULT 0 NOT NULL,
	"cited_fragment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'drafting' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fragments" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster_id" text NOT NULL,
	"source" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reflowed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gaps" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"cluster_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supporting_fragment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"draft_id" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"ai_ratio_limit" real DEFAULT 0.3 NOT NULL,
	"expand_limit" integer DEFAULT 3 NOT NULL,
	"daily_inflow_limit" integer DEFAULT 20 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "writings" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"gap_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"user_words" integer DEFAULT 0 NOT NULL,
	"ai_words" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reflowed" boolean DEFAULT true NOT NULL
);
