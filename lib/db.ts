import { neon } from "@neondatabase/serverless";
import { genId } from "./utils";
import fs from "fs";
import path from "path";

export type { PlazaUser, PlazaPost, UserSearchParams } from "./types";
import { mintCoins } from "./economy";
import { assignRandomCamp, markOnline } from "./camps";
import type { PlazaUser, PlazaPost, UserSearchParams } from "./types";

const USER_NO_PREFIX = "XL";
const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS plaza_users (
      id TEXT PRIMARY KEY,
      user_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      occupation TEXT,
      description TEXT,
      avatar_url TEXT,
      route TEXT,
      wallet_address TEXT,
      city_id TEXT NOT NULL DEFAULT 'xingluo',
      reputation INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 0,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // 迁移：给已有表加新列
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS wallet_address TEXT`.catch(() => {});
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS city_id TEXT NOT NULL DEFAULT 'xingluo'`.catch(() => {});

  await sql`
    CREATE TABLE IF NOT EXISTS plaza_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      camp_id TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE plaza_posts ADD COLUMN IF NOT EXISTS camp_id TEXT`.catch(() => {});
  await sql`ALTER TABLE plaza_posts ADD COLUMN IF NOT EXISTS tag TEXT`.catch(() => {});
  await sql`ALTER TABLE plaza_posts ADD COLUMN IF NOT EXISTS price REAL NOT NULL DEFAULT 0`.catch(() => {});
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS space_url TEXT`.catch(() => {});
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS space_visits INTEGER NOT NULL DEFAULT 0`.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS space_visit_logs (
      id TEXT PRIMARY KEY,
      space_owner_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`ALTER TABLE plaza_posts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web'`.catch(() => {});
  // 阅读记录表
  await sql`
    CREATE TABLE IF NOT EXISTS post_reads (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      paid REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `.catch(() => {});
  schemaReady = true;
}

async function nextUserNo(): Promise<string> {
  if (DATABASE_URL) {
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT COUNT(*)::int AS cnt FROM plaza_users`;
    return `${USER_NO_PREFIX}-${String((rows[0].cnt as number) + 1).padStart(6, "0")}`;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  return `${USER_NO_PREFIX}-${String(users.length + 1).padStart(6, "0")}`;
}

// ============ 文件回退 ============

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readJson<T>(fp: string, fb: T): T {
  ensureDir(); if (!fs.existsSync(fp)) return fb;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return fb; }
}
function writeJson<T>(fp: string, d: T) { ensureDir(); fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf-8"); }

/** 解析标签：兼容旧单字符串和新 JSON 数组 */
function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  const s = String(raw);
  if (s.startsWith("[")) { try { return JSON.parse(s); } catch { return []; } }
  return s ? [s] : [];
}

function mapUser(r: Record<string, unknown>): PlazaUser {
  return {
    id: r.id as string, userNo: r.user_no as string, name: r.name as string,
    occupation: r.occupation as string | null, description: r.description as string | null,
    avatarUrl: r.avatar_url as string | null, route: r.route as string | null,
    walletAddress: r.wallet_address as string | null,
    spaceUrl: (r.space_url as string) ?? null,
    cityId: (r.city_id as string) ?? "xingluo",
    campId: (r.camp_id as string) ?? null,
    isOnline: (r.is_online as boolean) ?? false,
    lastSeenAt: (r.last_seen_at as string) ?? null,
    reputation: r.reputation as number, coins: r.coins as number, compute: (r.compute as number) ?? 0,
    spaceVisits: (r.space_visits as number) ?? 0,
    joinedAt: r.joined_at as string,
  };
}

// ============ 用户 CRUD ============

export async function upsertPlazaUser(
  input: Omit<PlazaUser, "userNo" | "reputation" | "coins" | "compute" | "walletAddress" | "spaceUrl" | "cityId" | "campId" | "isOnline" | "lastSeenAt" | "spaceVisits"> & {
    occupation?: string | null;
    description?: string | null;
    walletAddress?: string | null;
    cityId?: string;
  }
): Promise<PlazaUser> {
  const occupation = input.occupation ?? null;
  const description = input.description ?? null;
  const cityId = input.cityId ?? "xingluo";

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const existing = await sql`
      SELECT user_no, occupation, description, wallet_address, city_id, reputation, coins, compute
      FROM plaza_users WHERE id = ${input.id}
    `;
    if (existing.length > 0) {
      const e = existing[0];
      const newOcc = occupation ?? e.occupation;
      const newDesc = description ?? e.description;
      await sql`
        UPDATE plaza_users SET name = ${input.name}, avatar_url = ${input.avatarUrl}, route = ${input.route},
          occupation = ${newOcc}, description = ${newDesc}, is_online = true, last_seen_at = NOW()
        WHERE id = ${input.id}
      `;
      markOnline(input.id).catch(() => {});
      return {
        ...input, occupation: newOcc, description: newDesc,
        userNo: e.user_no, walletAddress: e.wallet_address,
        cityId: e.city_id ?? "xingluo",
        spaceUrl: e.space_url ?? null,
        campId: e.camp_id ?? null, isOnline: true, lastSeenAt: new Date().toISOString(),
        reputation: e.reputation, coins: e.coins, compute: e.compute ?? 0, spaceVisits: e.space_visits ?? 0,
      };
    }
    const userNo = await nextUserNo();
    await sql`
      INSERT INTO plaza_users (id, user_no, name, occupation, description, avatar_url, route, wallet_address, city_id, reputation, coins, joined_at)
      VALUES (${input.id}, ${userNo}, ${input.name}, ${occupation}, ${description}, ${input.avatarUrl}, ${input.route}, ${input.walletAddress ?? null}, ${cityId}, 0, 0, ${input.joinedAt})
    `;
    // 新用户注册奖励 + 分配随机营地
    mintCoins(input.id, 100, "signup_bonus", "注册奖励").catch(() => {});
    const campId = await assignRandomCamp(input.id).catch(() => "camp_default") ?? "camp_default";
    return { ...input, userNo, occupation, description, walletAddress: input.walletAddress ?? null, spaceUrl: null, cityId, campId, isOnline: true, lastSeenAt: new Date().toISOString(), reputation: 0, coins: 100, compute: 0, spaceVisits: 0 };
  }

  // 文件回退
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const idx = users.findIndex((u) => u.id === input.id);
  if (idx >= 0) {
    users[idx] = {
      ...users[idx], name: input.name, avatarUrl: input.avatarUrl, route: input.route,
      occupation: occupation ?? users[idx].occupation,
      description: description ?? users[idx].description,
    };
    writeJson(USERS_FILE, users);
    return users[idx];
  }
  const userNo = await nextUserNo();
  const newUser: PlazaUser = {
    ...input, userNo, occupation, description,
    walletAddress: input.walletAddress ?? null, spaceUrl: null, cityId, campId: "camp_default", isOnline: true, lastSeenAt: new Date().toISOString(), reputation: 0, coins: 100, compute: 0, spaceVisits: 0,
  };
  users.push(newUser);
  writeJson(USERS_FILE, users);
  return newUser;
}

export async function getAllPlazaUsers(): Promise<PlazaUser[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM plaza_users ORDER BY joined_at DESC`;
    return rows.map(mapUser);
  }
  return readJson<PlazaUser[]>(USERS_FILE, []);
}

/** 搜索用户：按名字/职位精确搜索，按描述模糊搜索，随机返回最多 limit 条 */
export async function searchUsers(params: UserSearchParams): Promise<PlazaUser[]> {
  const limit = params.limit ?? 1000;

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    // 动态构建 WHERE 条件
    const conditions: string[] = [];
    if (params.cityId) conditions.push(`city_id = '${params.cityId}'`);

    let rows;
    if (params.name) {
      rows = await sql`
        SELECT * FROM plaza_users WHERE name ILIKE ${"%" + params.name + "%"}
        ORDER BY RANDOM() LIMIT ${limit}
      `;
    } else if (params.occupation) {
      rows = await sql`
        SELECT * FROM plaza_users WHERE occupation ILIKE ${"%" + params.occupation + "%"}
        ORDER BY RANDOM() LIMIT ${limit}
      `;
    } else if (params.description) {
      rows = await sql`
        SELECT * FROM plaza_users WHERE description ILIKE ${"%" + params.description + "%"}
        ORDER BY RANDOM() LIMIT ${limit}
      `;
    } else {
      rows = await sql`SELECT * FROM plaza_users ORDER BY RANDOM() LIMIT ${limit}`;
    }
    return rows.map(mapUser);
  }

  // 文件回退
  let users = readJson<PlazaUser[]>(USERS_FILE, []);
  if (params.cityId) users = users.filter((u) => u.cityId === params.cityId);
  if (params.name) users = users.filter((u) => u.name.toLowerCase().includes(params.name!.toLowerCase()));
  if (params.occupation) users = users.filter((u) => u.occupation?.toLowerCase().includes(params.occupation!.toLowerCase()));
  if (params.description) users = users.filter((u) => u.description?.toLowerCase().includes(params.description!.toLowerCase()));
  // 随机打乱
  users.sort(() => Math.random() - 0.5);
  return users.slice(0, limit);
}

/** 更新用户信誉分 */
export async function updateReputation(userId: string, delta: number): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE plaza_users SET reputation = reputation + ${delta} WHERE id = ${userId}`;
    return;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === userId);
  if (user) { user.reputation += delta; writeJson(USERS_FILE, users); }
}

/** 更新用户个人信息（职位、描述等） */
export async function updateUserProfile(userId: string, data: {
  name?: string; occupation?: string; description?: string; walletAddress?: string; spaceUrl?: string;
}): Promise<PlazaUser | null> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    if (data.name) await sql`UPDATE plaza_users SET name = ${data.name} WHERE id = ${userId}`;
    if (data.occupation !== undefined) await sql`UPDATE plaza_users SET occupation = ${data.occupation} WHERE id = ${userId}`;
    if (data.description !== undefined) await sql`UPDATE plaza_users SET description = ${data.description} WHERE id = ${userId}`;
    if (data.walletAddress !== undefined) await sql`UPDATE plaza_users SET wallet_address = ${data.walletAddress} WHERE id = ${userId}`;
    if (data.spaceUrl !== undefined) await sql`UPDATE plaza_users SET space_url = ${data.spaceUrl} WHERE id = ${userId}`;
    const [row] = await sql`SELECT * FROM plaza_users WHERE id = ${userId}`;
    return row ? mapUser(row) : null;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  if (data.name) user.name = data.name;
  if (data.occupation !== undefined) user.occupation = data.occupation;
  if (data.description !== undefined) user.description = data.description;
  if (data.walletAddress !== undefined) user.walletAddress = data.walletAddress;
  if (data.spaceUrl !== undefined) user.spaceUrl = data.spaceUrl ?? null;
  writeJson(USERS_FILE, users);
  return user;
}

/** 记录空间访问 */
export async function visitSpace(ownerId: string, visitorId: string): Promise<void> {
  if (ownerId === visitorId) return; // 不记录自己访问自己
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO space_visit_logs (id, space_owner_id, visitor_id) VALUES (${genId("sv")}, ${ownerId}, ${visitorId})`;
    await sql`UPDATE plaza_users SET space_visits = space_visits + 1 WHERE id = ${ownerId}`;
  }
}

/** 获取谁访问了我的空间 */
export async function getSpaceVisitors(ownerId: string, limit = 50): Promise<{ visitorId: string; visitorName: string; visitedAt: string }[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT sv.visitor_id, u.name AS visitor_name, sv.created_at
      FROM space_visit_logs sv JOIN plaza_users u ON sv.visitor_id = u.id
      WHERE sv.space_owner_id = ${ownerId}
      ORDER BY sv.created_at DESC LIMIT ${limit}
    `;
    return rows.map((r) => ({ visitorId: r.visitor_id as string, visitorName: r.visitor_name as string, visitedAt: r.created_at as string }));
  }
  return [];
}

// ============ 帖子 ============

export async function createPost(post: Omit<PlazaPost, "id" | "createdAt" | "images" | "tags"> & { images?: string[]; tags?: string[]; price?: number; source?: "mcp" | "web" }): Promise<PlazaPost> {
  const id = genId("post");
  const createdAt = new Date().toISOString();
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const tagsJson = JSON.stringify(post.tags ?? []);
    const source = post.source ?? "web";
    await sql`INSERT INTO plaza_posts (id, user_id, user_name, user_avatar, camp_id, tag, price, source, content, created_at)
      VALUES (${id}, ${post.userId}, ${post.userName}, ${post.userAvatar}, ${post.campId ?? null}, ${tagsJson}, ${post.price ?? 0}, ${source}, ${post.content}, ${createdAt})`;
    return { ...post, source: (post.source ?? "web") as "mcp" | "web", tags: post.tags ?? [], price: post.price ?? 0, images: post.images ?? [], id, createdAt };
  }
  const posts = readJson<PlazaPost[]>(POSTS_FILE, []);
  const newPost: PlazaPost = { ...post, source: (post.source ?? "web") as "mcp" | "web", tags: post.tags ?? [], images: post.images ?? [], id, createdAt };
  posts.unshift(newPost);
  writeJson(POSTS_FILE, posts);
  return newPost;
}

export async function getAllPosts(): Promise<PlazaPost[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT id, user_id, user_name, user_avatar, camp_id, source, tag, price, content, created_at FROM plaza_posts ORDER BY created_at DESC`;
    return rows.map((r) => ({
      id: r.id, userId: r.user_id, userName: r.user_name,
      userAvatar: r.user_avatar, campId: r.camp_id ?? null, source: (r.source as "mcp" | "web") ?? "web", tags: parseTags(r.tag), price: (r.price as number) ?? 0, content: r.content, images: [], createdAt: r.created_at,
    }));
  }
  return readJson<PlazaPost[]>(POSTS_FILE, []);
}

/** 查某个营地的帖子（闲逛者查看用） */
export async function getCampPosts(campId: string): Promise<PlazaPost[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT id, user_id, user_name, user_avatar, camp_id, source, tag, price, content, created_at FROM plaza_posts WHERE camp_id = ${campId} ORDER BY created_at DESC`;
    return rows.map((r) => ({
      id: r.id, userId: r.user_id, userName: r.user_name,
      userAvatar: r.user_avatar, campId: r.camp_id ?? null, source: (r.source as "mcp" | "web") ?? "web", tags: parseTags(r.tag), price: (r.price as number) ?? 0, content: r.content, images: [], createdAt: r.created_at,
    }));
  }
  return readJson<PlazaPost[]>(POSTS_FILE, []).filter((p) => p.campId === campId);
}

export async function getUserPosts(userId: string): Promise<PlazaPost[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT id, user_id, user_name, user_avatar, camp_id, source, tag, price, content, created_at FROM plaza_posts WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map((r) => ({
      id: r.id, userId: r.user_id, userName: r.user_name,
      userAvatar: r.user_avatar, campId: r.camp_id ?? null, source: (r.source as "mcp" | "web") ?? "web", tags: parseTags(r.tag), price: (r.price as number) ?? 0, content: r.content, images: [], createdAt: r.created_at,
    }));
  }
  return readJson<PlazaPost[]>(POSTS_FILE, []).filter((p) => p.userId === userId);
}

/** 检查用户是否已阅读（已付费）某帖子 */
export async function hasReadPost(postId: string, userId: string): Promise<boolean> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT 1 FROM post_reads WHERE post_id = ${postId} AND user_id = ${userId}`;
    return rows.length > 0;
  }
  const reads = readJson<{ postId: string; userId: string }[]>(path.join(DATA_DIR, "post_reads.json"), []);
  return reads.some((r) => r.postId === postId && r.userId === userId);
}

/** 记录阅读（付费） */
export async function markPostRead(postId: string, userId: string, paid: number): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO post_reads (post_id, user_id, paid) VALUES (${postId}, ${userId}, ${paid}) ON CONFLICT DO NOTHING`;
    return;
  }
  const fp = path.join(DATA_DIR, "post_reads.json");
  const reads = readJson<{ postId: string; userId: string; paid: number }[]>(fp, []);
  if (!reads.some((r) => r.postId === postId && r.userId === userId)) {
    reads.push({ postId, userId, paid });
    writeJson(fp, reads);
  }
}
