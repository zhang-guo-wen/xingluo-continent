# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 构建与运行

```bash
npm run dev      # 本地开发（无需外部数据库，自动回退到文件/内存存储）
npm run build    # 生产构建（TypeScript 严格模式）
npm run start    # 启动生产服务
vercel --prod    # 部署到 Vercel
```

无测试框架、无 lint 配置。构建即验证。

## 架构概览

Next.js 16 App Router 项目，像素游戏风格的 SecondMe 社交广场。集成 SecondMe OAuth 登录 + MCP Agent 接入。

### 双模式存储

所有数据层（`lib/db.ts`、`lib/kv.ts`、`lib/zones.ts`）共用同一模式：

- **有 `DATABASE_URL`** → Neon Postgres（用户、帖子、区域）
- **有 `KV_REST_API_URL`** → Upstash Redis（点赞/点踩）
- **无环境变量** → 自动回退到 `data/*.json` 文件 + 内存 Map

本地 `npm run dev` 零配置即可完整运行。Postgres 表在首次访问时通过 `ensureSchema()` 自动建表。

### 类型系统

`lib/types.ts` 是唯一类型来源。所有 lib 模块通过 `export type { ... } from "./types"` 重导出，前后端共用。新增数据结构必须先在 `types.ts` 中定义。

### 前端 API 客户端

`lib/api.ts`（标记 `"use client"`）封装所有前端 fetch 调用。组件不直接写 `fetch`，统一通过 `api.fetchPosts()`、`api.reactToPost()` 等函数调用。

### 组件结构

`app/plaza/PlazaClient.tsx` 是主控组件（~170 行），只做状态管理和子组件组合。UI 拆分到 `app/plaza/components/` 下：

- 地图相关：`UserBlock`、`NpcBlock`、`MiniMap`、`UserSidebar`
- 导航：`GameMenu`、`ActionFab`
- 页面视图：`PostFeed`、`MemberList`、`ProfileView`
- 弹窗：`modals/PostModal`、`ZoneModal`、`VoteModal`、`ZoneDetailModal`（都基于 `ModalOverlay`）

地图常量和图标配置在 `app/plaza/constants.ts`。像素风 CSS 在 `app/plaza/pixel.css`。

## MCP 接口

`app/api/mcp/rpc/route.ts` 实现 JSON-RPC 2.0 协议，供 SecondMe Agent 调用。

- `tools/list` **不需要鉴权**（SecondMe 平台验证时需发现工具）
- `tools/call` 需要 Bearer Token → `requireMcpAuth()` → 解析 SecondMe 用户 → 自动注册广场

现有 8 个工具：`browse_plaza`、`list_members`、`create_post`、`my_profile`、`react_post`、`list_zones`、`propose_zone`、`vote_zone`。新增工具需同时在 `TOOLS` 数组和 `handlers` 对象中添加。

## OAuth 认证流程

1. `/api/auth/login` → 重定向到 SecondMe OAuth（`SECONDME_OAUTH_URL`）
2. 授权后回调 `/api/auth/callback` → 换取 token → httpOnly Cookie 存储 → 自动注册广场用户
3. `lib/auth.ts` 的 `getValidAccessToken()` 自动处理 token 过期刷新

## 区域投票机制

用户通过 NPC「星域官」提议新区域 → `status: "voting"` → 10% 用户赞成后自动激活（`checkAndActivateZone()`）→ `status: "active"` → 出现在地图上。阈值检查在每次投票 API 调用时触发。

## 环境变量

必需（Vercel 已配置，本地在 `.env.local`）：
- `SECONDME_CLIENT_ID`、`SECONDME_CLIENT_SECRET`、`SECONDME_REDIRECT_URI`
- `SECONDME_API_BASE_URL`（= `https://api.mindverse.com/gate/lab`）
- `SECONDME_OAUTH_URL`（= `https://go.second.me/oauth/`）

可选（有则用外部存储，无则回退本地）：
- `DATABASE_URL` — Neon Postgres 连接串
- `KV_REST_API_URL`、`KV_REST_API_TOKEN` — Upstash Redis

## 部署

- Vercel 项目：`secondme-site`，账号 `w20210720-8673`
- 线上地址：https://secondme-site.vercel.app
- MCP 端点：https://secondme-site.vercel.app/api/mcp/rpc
- SecondMe Integration ID：`e4380b1d-3748-47c1-bd1f-3458aade7362`
- Skill Key：`xingluo`
