#!/usr/bin/env node
// 应用已生成的数据库迁移（src/lib/db/migrations/）。
// 只用 drizzle-orm + postgres（均已在依赖中、无 esbuild-kit 漏洞链），
// 不再需要 drizzle-kit CLI。迁移文件本身由开发者用 `npx drizzle-kit generate` 一次性生成后入库。
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[db:migrate] DATABASE_URL 未设置，跳过。");
  process.exit(1);
}

const needsSsl = /neon\.tech|sslmode=require/.test(url);
const sql = postgres(url, { max: 1, ssl: needsSsl ? "require" : undefined });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./src/lib/db/migrations" });
  console.log("[db:migrate] 迁移应用完成。");
} catch (err) {
  console.error("[db:migrate] 失败：", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
