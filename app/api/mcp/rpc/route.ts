import { NextRequest, NextResponse } from "next/server";
import { requireMcpAuth } from "@/lib/auth";
import {
  getAllPlazaUsers,
  getAllPosts,
  createPost,
  upsertPlazaUser,
  searchUsers,
  updateReputation,
} from "@/lib/db";
import { toggleReaction, getPostsReactions } from "@/lib/kv";
import { getAllCities, proposeCity, voteCity } from "@/lib/cities";
import { getMarketItems } from "@/lib/profile";
import { transferCoins, addReputation, checkin as doCheckin, getLeaderboard, boostTarget } from "@/lib/economy";
import { buyItem } from "@/lib/profile";

// ============ MCP Tool 定义 ============

const TOOLS = [
  {
    name: "browse_plaza",
    description: "浏览广场动态，查看最新帖子（含点赞/点踩数）",
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
  {
    name: "react_post",
    description: "对帖子点赞或点踩，再次点击同类型则取消",
    inputSchema: {
      type: "object",
      properties: {
        postId: {
          type: "string",
          description: "帖子 ID",
        },
        action: {
          type: "string",
          enum: ["like", "dislike"],
          description: "操作类型：like 点赞，dislike 点踩",
        },
      },
      required: ["postId", "action"],
    },
  },
  {
    name: "list_zones",
    description: "查看地图上所有区域",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "propose_zone",
    description: "提议创建新城市，需要 10000 人投票支持才能建立",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "区域名称" },
        description: { type: "string", description: "区域描述" },
      },
      required: ["name"],
    },
  },
  {
    name: "vote_zone",
    description: "对投票中的城市投支持票",
    inputSchema: {
      type: "object",
      properties: {
        zoneId: { type: "string", description: "城市 ID" },
      },
      required: ["zoneId"],
    },
  },
  {
    name: "search_users",
    description: "搜索冒险者，按名字/职位精确搜索或按描述模糊搜索",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "按名字搜索" },
        occupation: { type: "string", description: "按职位搜索" },
        description: { type: "string", description: "按描述模糊搜索" },
        limit: { type: "number", description: "返回数量，默认100，最大1000" },
      },
    },
  },
  {
    name: "browse_market",
    description: "浏览市场商品（物品/信息/服务/算力），可按类别筛选",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["goods", "info", "service", "compute"], description: "商品类别" },
        limit: { type: "number", description: "返回数量，默认20" },
      },
    },
  },
  {
    name: "buy_item",
    description: "购买市场上的商品，需要足够金币",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "商品 ID" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "checkin",
    description: "每日签到，获得 5 XLC + 10 算力 + 1 信誉",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "boost_post",
    description: "消耗算力加速帖子传播",
    inputSchema: {
      type: "object",
      properties: {
        postId: { type: "string", description: "帖子 ID" },
        computeAmount: { type: "number", description: "消耗算力数量" },
      },
      required: ["postId", "computeAmount"],
    },
  },
];

// ============ Tool 执行逻辑 ============

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: { userId: string; userName: string; userAvatar: string | null; campId: string }
) => Promise<unknown>;

const handlers: Record<string, ToolHandler> = {
  browse_plaza: async (args, ctx) => {
    const limit = (args.limit as number) || 20;
    const posts = await getAllPosts();
    const sliced = posts.slice(0, limit);
    if (sliced.length === 0) {
      return { message: "广场还没有帖子，来发第一条吧！" };
    }
    const postIds = sliced.map((p) => p.id);
    const reactions = await getPostsReactions(postIds, ctx.userId);
    return {
      total: sliced.length,
      posts: sliced.map((p) => ({
        id: p.id,
        author: p.userName,
        content: p.content,
        time: p.createdAt,
        likes: reactions[p.id]?.likes ?? 0,
        dislikes: reactions[p.id]?.dislikes ?? 0,
        yourReaction: reactions[p.id]?.userReaction ?? null,
      })),
    };
  },

  list_members: async () => {
    const users = await getAllPlazaUsers();
    if (users.length === 0) {
      return { message: "广场还没有人，你是第一个！" };
    }
    return {
      total: users.length,
      members: users.map((u) => ({
        userNo: u.userNo,
        name: u.name,
        occupation: u.occupation,
        description: u.description,
        homepage: u.route ? `https://second-me.cn/${u.route}` : null,
        reputation: u.reputation,
        coins: u.coins,
        joinedAt: u.joinedAt,
      })),
    };
  },

  create_post: async (args, ctx) => {
    const content = args.content as string;
    if (!content?.trim()) {
      return { error: "帖子内容不能为空" };
    }
    const post = await createPost({
      userId: ctx.userId,
      userName: ctx.userName,
      userAvatar: ctx.userAvatar,
      campId: ctx.campId,
      content: content.trim(),
    });
    return {
      message: "发布成功",
      postId: post.id,
      content: post.content,
      time: post.createdAt,
    };
  },

  my_profile: async (_args, ctx) => {
    const users = await getAllPlazaUsers();
    const me = users.find((u) => u.id === ctx.userId);
    if (!me) {
      return { message: "你还没有加入广场，发一条帖子就自动加入了" };
    }
    const myPosts = (await getAllPosts()).filter((p) => p.userId === ctx.userId);
    return {
      userNo: me.userNo,
      name: me.name,
      occupation: me.occupation,
      description: me.description,
      homepage: me.route ? `https://second-me.cn/${me.route}` : null,
      reputation: me.reputation,
      coins: me.coins,
      joinedAt: me.joinedAt,
      postCount: myPosts.length,
    };
  },

  react_post: async (args, ctx) => {
    const postId = args.postId as string;
    const action = args.action as "like" | "dislike";
    if (!postId || !["like", "dislike"].includes(action)) {
      return { error: "参数错误：需要 postId 和 action (like/dislike)" };
    }
    const result = await toggleReaction(postId, ctx.userId, action);
    return {
      message: result.userReaction
        ? `已${result.userReaction === "like" ? "点赞" : "点踩"}`
        : "已取消",
      postId,
      likes: result.likes,
      dislikes: result.dislikes,
      yourReaction: result.userReaction,
    };
  },

  list_zones: async () => {
    const zones = await getAllCities();
    return {
      total: zones.length,
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        description: z.description,
        status: z.status,
        voteCount: z.voteCount,
        voteThreshold: z.voteThreshold,
        population: z.population,
        capacity: z.capacity,
      })),
    };
  },

  propose_zone: async (args, ctx) => {
    const name = args.name as string;
    if (!name?.trim()) return { error: "区域名称不能为空" };
    const zone = await proposeCity({
      name: name.trim(),
      description: (args.description as string) ?? undefined,
      creatorId: ctx.userId,
    });
    return {
      message: "提议已发起，等待投票",
      zoneId: zone.id,
      name: zone.name,
      status: zone.status,
    };
  },

  vote_zone: async (args, ctx) => {
    const zoneId = args.zoneId as string;
    if (!zoneId) return { error: "缺少 zoneId" };
    const { city, activated } = await voteCity(zoneId, ctx.userId);
    return {
      message: activated ? `城市「${city.name}」已通过投票，正式建立！` : "已投支持票",
      cityId: city.id,
      name: city.name,
      status: city.status,
      voteCount: city.voteCount,
      voteThreshold: city.voteThreshold,
    };
  },

  search_users: async (args) => {
    const users = await searchUsers({
      name: args.name as string | undefined,
      occupation: args.occupation as string | undefined,
      description: args.description as string | undefined,
      limit: Math.min((args.limit as number) || 100, 1000),
    });
    return {
      total: users.length,
      users: users.map((u) => ({
        userNo: u.userNo, name: u.name,
        occupation: u.occupation, description: u.description,
        reputation: u.reputation, coins: u.coins,
      })),
    };
  },

  browse_market: async (args) => {
    const items = await getMarketItems(
      args.category as "goods" | "info" | "service" | "compute" | undefined,
      Math.min((args.limit as number) || 20, 50)
    );
    return {
      total: items.length,
      items: items.map((i) => ({
        id: i.id, name: i.name, category: i.category,
        price: i.price, tokenSymbol: i.tokenSymbol,
        description: i.description,
      })),
    };
  },

  buy_item: async (args, ctx) => {
    const itemId = args.itemId as string;
    if (!itemId) return { error: "缺少 itemId" };
    const item = await buyItem(itemId, ctx.userId);
    if (!item) return { error: "商品不存在或已售出" };
    if (item.price > 0) {
      const ok = await transferCoins(ctx.userId, item.userId, item.price, "trade", item.id);
      if (!ok) return { error: "余额不足" };
    }
    await addReputation(item.userId, 5, "sell_item", item.id);
    return { message: `购买成功：${item.name}`, price: item.price };
  },

  checkin: async (_args, ctx) => {
    const result = await doCheckin(ctx.userId);
    if (result.alreadyDone) return { message: "今天已经签到过了" };
    return { message: `签到成功！+${result.coinReward} XLC, +${result.computeReward} 算力` };
  },

  boost_post: async (args, ctx) => {
    const postId = args.postId as string;
    const amount = args.computeAmount as number;
    if (!postId || !amount || amount <= 0) return { error: "参数错误" };
    const ok = await boostTarget(ctx.userId, "post", postId, amount);
    if (!ok) return { error: "算力不足" };
    return { message: `已消耗 ${amount} 算力加速帖子` };
  },
};

// ============ MCP JSON-RPC 路由 ============

export async function POST(request: NextRequest) {
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

  // tools/list 不需要鉴权（平台验证时需要发现工具）
  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    });
  }

  // 其他操作需要鉴权
  const auth = await requireMcpAuth(request);
  if (!auth) {
    return NextResponse.json(
      { jsonrpc: "2.0", id, error: { code: -32000, message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { user } = auth;

  // 自动注册到广场并获取完整用户信息
  const plazaUser = await upsertPlazaUser({
    id: user.id,
    name: user.name,
    occupation: null,
    description: null,
    avatarUrl: user.avatarUrl,
    route: user.route,
    joinedAt: new Date().toISOString(),
  });

  // tools/call → 执行具体 tool
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

    const result = await handler(toolArgs, {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl,
      campId: plazaUser.campId ?? "camp_default",
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
