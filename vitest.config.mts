import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest 配置：纯函数单元测试（Node 环境即可，无需浏览器 DOM）。
// 解析 tsconfig 的 "@/*" → "./src/*" 别名，让测试能 import 项目模块。
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
