import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getKbState, KbUnavailableError, kbUnavailableResult } from "../kb-access";

/** get_writing —— 按 id 读取单篇成文的完整正文与元数据。 */
export function registerGetWriting(server: McpServer) {
  server.registerTool(
    "get_writing",
    {
      description: "按 id 读取织知知识库中某篇成文(writing)的完整正文与元数据。id 来自 list_writings 或 search_knowledge。",
      inputSchema: {
        id: z.string().min(1).describe("成文 id"),
      },
    },
    async ({ id }) => {
      try {
        const { writings } = await getKbState();
        const w = writings.find((x) => x.id === id);
        if (!w) {
          return {
            isError: true,
            content: [{ type: "text", text: `未找到 id 为 ${id} 的成文。` }],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  id: w.id,
                  title: w.title,
                  content: w.content,
                  userWords: w.userWords,
                  aiWords: w.aiWords,
                  publishedAt: w.publishedAt,
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
