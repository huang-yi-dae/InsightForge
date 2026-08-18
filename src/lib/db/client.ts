import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 兼容 Neon / 任意 Postgres。没有 DATABASE_URL 时返回 null，
// 上层据此回退到 localStorage（前端本地存储）。
const connectionString = process.env.DATABASE_URL;

// Neon 的 pooled 连接需要 ssl；本地/内网库不强制。这里按连接串自动判断。
function makeClient() {
  if (!connectionString) return null;
  const needsSsl = /neon\.tech|sslmode=require/.test(connectionString);
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: needsSsl ? "require" : undefined,
  });
  return drizzle(sql, { schema });
}

// 全局缓存，避免开发热重载重复建连接。
const globalForDb = globalThis as unknown as {
  __zhizhiDb?: ReturnType<typeof makeClient>;
};

export const db = globalForDb.__zhizhiDb ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForDb.__zhizhiDb = db;

export const isDatabaseEnabled = Boolean(connectionString);
export { schema };
