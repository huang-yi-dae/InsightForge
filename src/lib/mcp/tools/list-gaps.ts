import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getKbState, KbUnavailableError, kbUnavailableResult } from "../kb-access";

/** list_gaps —— 列出选题缺口(gaps)，可按状态过滤，按 confidence 降序。 */
export function registerListGaps(server: McpServer) {
  server.registerTool(
    "list_gaps",
    {
      description:
        "列出织知的选题缺口(gaps)——从知识库聚类中发现的、值得写但还没写的题目。含标题、把握度(confidence)、支撑碎片数与状态。用于回答『我接下来可以写点什么』。",
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe("按状态过滤，如 open / drafting / published；留空返回全部"),
        limit: z.number().int().positive().max(100).optional().describe("最多返回条数，默认 30"),
      },
    },
    async ({ status, limit }) => {
      try {
        const { gaps } = await getKbState();
        const filtered = status ? gaps.filter((g) => g.status === status) : gaps;
        const rows = [...filtered]
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, limit ?? 30)
          .map((g) => ({
            id: g.id,
            title: g.title,
            confidence: g.confidence,
            status: g.status,
            supportingFragmentCount: g.supportingFragmentIds.length,
          }));
        return {
          content: [
            { type: "text", text: JSON.stringify({ count: rows.length, gaps: rows }, null, 2) },
          ],
        };
      } catch (e) {
        if (e instanceof KbUnavailableError) return kbUnavailableResult();
        throw e;
      }
    },
  );
}
