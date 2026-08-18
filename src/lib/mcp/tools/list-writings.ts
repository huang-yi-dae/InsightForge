import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getKbState, KbUnavailableError, kbUnavailableResult } from "../kb-access";

/** list_writings —— 列出已成文的作品清单（不含正文），按发布时间倒序。 */
export function registerListWritings(server: McpServer) {
  server.registerTool(
    "list_writings",
    {
      description:
        "列出织知知识库中所有已完成的成文(writings)，含标题、发布时间、字数与 AI 占比，不含正文。要读正文用 get_writing。",
      inputSchema: {
        limit: z.number().int().positive().max(100).optional().describe("最多返回条数，默认 30"),
      },
    },
    async ({ limit }) => {
      try {
        const { writings } = await getKbState();
        const sorted = [...writings].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        const rows = sorted.slice(0, limit ?? 30).map((w) => {
          const total = w.userWords + w.aiWords;
          return {
            id: w.id,
            title: w.title,
            publishedAt: w.publishedAt,
            userWords: w.userWords,
            aiWords: w.aiWords,
            aiRatio: total > 0 ? Number((w.aiWords / total).toFixed(3)) : 0,
          };
        });
        return {
          content: [
            { type: "text", text: JSON.stringify({ count: rows.length, writings: rows }, null, 2) },
          ],
        };
      } catch (e) {
        if (e instanceof KbUnavailableError) return kbUnavailableResult();
        throw e;
      }
    },
  );
}
