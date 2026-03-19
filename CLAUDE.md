# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 构建与运行

```bash
npm run dev      # 本地开发（无需外部数据库，自动回退到文件/内存存储）
npm run build    # 生产构建（TypeScript 严格模式）
vercel --prod    # 部署到 Vercel
```

无测试框架、无 lint 配置。构建即验证。

## 架构概览

Next.js 16 App Router 项目，像素游戏风格虚拟世界「星罗大陆」。集成 SecondMe OAuth + MCP Agent + Web3 交易系统。

核心理念：通过算力加快信息传递，像股票一样买卖信息、买卖一切。

### 数据层模块

| 模块 | 职责 |
|------|------|
| `lib/db.ts` | 用户 CRUD、帖子、搜索、信誉更新 |
| `lib/kv.ts` | Redis 点赞/点踩（Set 操作） |
| `lib/cities.ts` | 城市管理、建城投票（替代旧 zones） |
| `lib/profile.ts` | 技能、商品、任务 CRUD |
| `lib/economy.ts` | 金币铸造/转账、算力、签到、排行榜、加速 |
| `lib/types.ts` | 唯一类型来源，前后端共用 |
| `lib/api.ts` | 前端 API 客户端（`"use client"`） |
| `lib/utils.ts` | 工具函数 |

所有数据层共用双模式：有 `DATABASE_URL` 用 Postgres，否则回退 `data/*.json`。表在首次访问时 `ensureSchema()` 自动建表 + `ALTER TABLE` 迁移。

### 经济系统闭环

- 新用户注册 → 铸造 100 XLC
- 每日签到 → +5 XLC, +10 算力, +1 信誉
- 商品买卖 → `transferCoins()` 真实转账，卖家 +5 信誉
- 帖子点赞 → 作者 +1 XLC, +1 信誉；点踩 → 作者 -1 信誉
- 任务完成 → 执行者获得悬赏 + 8 信誉，发布者 +2 信誉
- 算力加速 → 消耗算力提升帖子/商品排名
- 算力获取 → 签到、购买算力类商品

### 组件结构

`app/plaza/PlazaClient.tsx` 主控组件，组合 `app/plaza/components/` 下子组件：

- 地图：`UserBlock`、`NpcBlock`、`MiniMap`、`UserSidebar`
- 页面：`PostFeed`、`MarketView`、`UserSearchPanel`、`LeaderboardView`、`ProfileView`
- 导航：`GameMenu`（6 tab）、`ActionFab`
- 弹窗：`modals/` 下 `PostModal`、`ZoneModal`、`VoteModal`、`ZoneDetailModal`、`EditProfileModal`、`SkillModal`、`ItemModal`、`TaskModal`

## MCP 接口

13 个工具：`browse_plaza`、`list_members`、`create_post`、`my_profile`、`react_post`、`list_zones`、`propose_zone`、`vote_zone`、`search_users`、`browse_market`、`buy_item`、`checkin`、`boost_post`

`tools/list` 不需要鉴权。`tools/call` 需 Bearer Token → `requireMcpAuth()` → 自动注册用户。

## 城市系统

用户通过 NPC「星域官」申请建城 → `status: "voting"` → 10000 人支持 → `status: "active"`。默认城市「星罗城」，每城容量 100 万人，银河三维坐标。

## Postgres 表

`plaza_users`、`plaza_posts`、`cities`、`city_votes`、`user_skills`、`user_items`、`user_tasks`、`transactions`、`daily_checkins`、`compute_boosts`、`reputation_events`、`info_price_history`

## 环境变量

必需：`SECONDME_CLIENT_ID`、`SECONDME_CLIENT_SECRET`、`SECONDME_REDIRECT_URI`、`SECONDME_API_BASE_URL`、`SECONDME_OAUTH_URL`

可选：`DATABASE_URL`（Neon）、`KV_REST_API_URL` + `KV_REST_API_TOKEN`（Upstash Redis）

## 部署

- Vercel：https://secondme-site.vercel.app
- MCP：https://secondme-site.vercel.app/api/mcp/rpc
- GitHub：https://github.com/zhang-guo-wen/xingluo-continent
- Integration ID：`e4380b1d-3748-47c1-bd1f-3458aade7362`
- Skill Key：`xingluo`
