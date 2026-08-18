import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchKnowledge } from "./tools/search-knowledge";
import { registerListWritings } from "./tools/list-writings";
import { registerGetWriting } from "./tools/get-writing";
import { registerListGaps } from "./tools/list-gaps";

/**
 * 组装织知知识库 MCP Server。
 * 织知是单一共享知识库（自部署、无多用户），因此工具无需 userId；
 * 访问控制在 /api/mcp 入口用 MCP_TOKEN 统一把关（见 route.ts）。
 * 当前所有工具均为只读，不暴露任何破坏性操作。
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "zhizhi-insightforge",
    version: "1.0.0",
  });

  registerSearchKnowledge(server);
  registerListWritings(server);
  registerGetWriting(server);
  registerListGaps(server);

  return server;
}
