import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

// 织知是单一共享知识库、无多用户体系。MCP 端点用一个部署级令牌 MCP_TOKEN 统一把关：
//   · 未配置 MCP_TOKEN → 端点整体禁用（避免把知识库裸暴露给公网）
//   · 配置后：请求需带 `x-mcp-token: <token>` 或 `Authorization: Bearer <token>`
// 令牌只在服务端环境变量里，永不落库/日志。
function tokenFromRequest(request: NextRequest): string | null {
  const header = request.headers.get("x-mcp-token");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function unauthorized(message: string): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message } },
    { status: 401 },
  );
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const expected = process.env.MCP_TOKEN?.trim();
  if (!expected) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "MCP 端点未启用：请在部署环境配置 MCP_TOKEN 后再连接。",
        },
      },
      { status: 503 },
    );
  }

  const provided = tokenFromRequest(request);
  if (!provided || !safeEqual(provided, expected)) {
    return unauthorized("无效或缺失的 MCP 令牌（请在 x-mcp-token 或 Authorization: Bearer 中提供）。");
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    // 无状态模式：每次 serverless 调用独立，兼容 Vercel / Edge。
    sessionIdGenerator: undefined,
  });

  const server = buildMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
