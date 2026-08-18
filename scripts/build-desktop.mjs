#!/usr/bin/env node
// 桌面端静态导出构建。
// Next 的 output:'export' 不支持 API routes（route.ts 会直接报错）。
// 桌面端全程走 BYOK 前端直连，不需要这些代理路由，因此导出前把
// src/app/api 临时移出工作区，导出完成后（无论成败）再移回，保证 web 端不受影响。
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "src", "app", "api");
const parked = join(root, ".api-parked");
const outDir = join(root, "out");

function park() {
  if (existsSync(apiDir)) {
    if (existsSync(parked)) rmSync(parked, { recursive: true, force: true });
    renameSync(apiDir, parked);
    console.log("[desktop] parked src/app/api -> .api-parked");
  }
}
function restore() {
  if (existsSync(parked)) {
    if (existsSync(apiDir)) rmSync(apiDir, { recursive: true, force: true });
    renameSync(parked, apiDir);
    console.log("[desktop] restored .api-parked -> src/app/api");
  }
}

process.on("SIGINT", () => { restore(); process.exit(130); });
process.on("SIGTERM", () => { restore(); process.exit(143); });

let code = 0;
try {
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  park();
  // shell:true 保证 Windows 能解析 npx.cmd（否则 spawnSync 直接找不到 npx 而秒退）。
  const res = spawnSync("npx next build", {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DESKTOP: "1", NEXT_PUBLIC_DESKTOP: "1" },
  });
  code = res.status ?? 1;
} finally {
  restore();
}

if (code === 0 && !existsSync(join(outDir, "index.html"))) {
  console.error("[desktop] export finished but out/index.html missing");
  code = 1;
}
console.log(code === 0 ? "[desktop] static export OK -> out/" : "[desktop] build FAILED");
process.exit(code);
