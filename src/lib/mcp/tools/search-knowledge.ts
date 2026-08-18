import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchKnowledge } from "@/lib/zhizhi/search";
import { getKbState, KbUnavailableError, kbUnavailableResult } from "../kb-access";

/**
 * search_knowledge —— 在个人知识库的碎片与成文中做关键词检索，按相关度排序。
 * 复用与 App 内搜索完全一致的打分逻辑（多关键词重叠 + 标题加权）。
 */
export function registerSearchKnowledge(server: McpServer) {
  server.registerTool(
    "search_knowledge",
    {
      description:
        "在织知个人知识库中检索碎片(fragments)与成文(writings)。支持多关键词（空格/标点分隔），结果按相关度降序返回。用于回答『我之前记过/写过关于 X 的什么』这类问题。",
      inputSchema: {
        query: z.string().min(1).describe("检索关键词，可含多个词，如『焦虑 写作』"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("最多返回条数，默认 20"),
      },
    },
    async ({ query, limit }) => {
      try {
        const { fragments, writings } = await getKbState();
        const hits = searchKnowledge(query, { fragments, writings }).slice(0, limit ?? 20);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  count: hits.length,
                  results: hits.map((h) => ({
                    kind: h.kind,
                    id: h.id,
                    title: h.title,
                    snippet: h.snippet,
                    score: Number(h.score.toFixed(3)),
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        if (e instanceof KbUnavailableError) return kbUnavailableResult();
        throw e;
      }
    },
  );
}
