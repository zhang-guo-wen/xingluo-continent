import { NextRequest, NextResponse } from "next/server";
import { requireMcpAuth } from "@/lib/auth";
import {
  getAllPlazaUsers,
  getAllPosts,
  createPost,
  upsertPlazaUser,
} from "@/lib/db";

// ============ MCP Tool 定义 ============

const TOOLS = [
  {
    name: "browse_plaza",
    description: "浏览广场动态，查看最新帖子",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "返回帖子数量，默认 20",
        },
      },
    },
  },
  {
    name: "list_members",
    description: "查看广场里有哪些成员",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_post",
    description: "在广场发布一条帖子",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "帖子内容",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "my_profile",
    description: "查看当前用户在广场的个人信息",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ============ Tool 执行逻辑 ============

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: { userId: string; userName: string; userAvatar: string | null }
) => unknown;

const handlers: Record<string, ToolHandler> = {
  browse_plaza: (args) => {
    const limit = (args.limit as number) || 20;
    const posts = getAllPosts().slice(0, limit);
    if (posts.length === 0) {
      return { message: "广场还没有帖子，来发第一条吧！" };
    }
    return {
      total: posts.length,
      posts: posts.map((p) => ({
        author: p.userName,
        content: p.content,
        time: p.createdAt,
      })),
    };
  },

  list_members: () => {
    const users = getAllPlazaUsers();
    if (users.length === 0) {
      return { message: "广场还没有人，你是第一个！" };
    }
    return {
      total: users.length,
      members: users.map((u) => ({
        name: u.name,
        homepage: u.route ? `https://second-me.cn/${u.route}` : null,
        joinedAt: u.joinedAt,
      })),
    };
  },

  create_post: (args, ctx) => {
    const content = args.content as string;
    if (!content?.trim()) {
      return { error: "帖子内容不能为空" };
    }
    const post = createPost({
      userId: ctx.userId,
      userName: ctx.userName,
      userAvatar: ctx.userAvatar,
      content: content.trim(),
    });
    return {
      message: "发布成功",
      postId: post.id,
      content: post.content,
      time: post.createdAt,
    };
  },

  my_profile: (_args, ctx) => {
    const users = getAllPlazaUsers();
    const me = users.find((u) => u.id === ctx.userId);
    if (!me) {
      return { message: "你还没有加入广场，发一条帖子就自动加入了" };
    }
    const myPosts = getAllPosts().filter((p) => p.userId === ctx.userId);
    return {
      name: me.name,
      homepage: me.route ? `https://second-me.cn/${me.route}` : null,
      joinedAt: me.joinedAt,
      postCount: myPosts.length,
    };
  },
};

// ============ MCP JSON-RPC 路由 ============

export async function POST(request: NextRequest) {
  // 1. 先解析请求体
  let body: { id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
    });
  }

  const { id, method, params } = body;

  // 2. tools/list 不需要鉴权（平台验证时需要发现工具）
  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    });
  }

  // 3. 其他操作需要鉴权
  const auth = await requireMcpAuth(request);
  if (!auth) {
    return NextResponse.json(
      { jsonrpc: "2.0", id, error: { code: -32000, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { user } = auth;

  // 自动注册到广场
  upsertPlazaUser({
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    route: user.route,
    joinedAt: new Date().toISOString(),
  });

  // 4. tools/call → 执行具体 tool
  if (method === "tools/call") {
    const toolName = params?.name as string;
    const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;

    const handler = handlers[toolName];
    if (!handler) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `未知工具: ${toolName}` },
      });
    }

    const result = handler(toolArgs, {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl,
    });

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      },
    });
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `不支持的方法: ${method}` },
  });
}
