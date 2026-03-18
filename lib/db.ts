import { neon } from "@neondatabase/serverless";
import { genId } from "./utils";
import fs from "fs";
import path from "path";

export type { PlazaUser, PlazaPost, UserSearchParams } from "./types";
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
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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

function mapUser(r: Record<string, unknown>): PlazaUser {
  return {
    id: r.id as string, userNo: r.user_no as string, name: r.name as string,
    occupation: r.occupation as string | null, description: r.description as string | null,
    avatarUrl: r.avatar_url as string | null, route: r.route as string | null,
    walletAddress: r.wallet_address as string | null,
    cityId: (r.city_id as string) ?? "xingluo",
    reputation: r.reputation as number, coins: r.coins as number,
    joinedAt: r.joined_at as string,
  };
}

// ============ 用户 CRUD ============

export async function upsertPlazaUser(
  input: Omit<PlazaUser, "userNo" | "reputation" | "coins" | "walletAddress" | "cityId"> & {
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
      SELECT user_no, occupation, description, wallet_address, city_id, reputation, coins
      FROM plaza_users WHERE id = ${input.id}
    `;
    if (existing.length > 0) {
      const e = existing[0];
      const newOcc = occupation ?? e.occupation;
      const newDesc = description ?? e.description;
      await sql`
        UPDATE plaza_users SET name = ${input.name}, avatar_url = ${input.avatarUrl}, route = ${input.route},
          occupation = ${newOcc}, description = ${newDesc}
        WHERE id = ${input.id}
      `;
      return {
        ...input, occupation: newOcc, description: newDesc,
        userNo: e.user_no, walletAddress: e.wallet_address,
        cityId: e.city_id ?? "xingluo",
        reputation: e.reputation, coins: e.coins,
      };
    }
    const userNo = await nextUserNo();
    await sql`
      INSERT INTO plaza_users (id, user_no, name, occupation, description, avatar_url, route, wallet_address, city_id, reputation, coins, joined_at)
      VALUES (${input.id}, ${userNo}, ${input.name}, ${occupation}, ${description}, ${input.avatarUrl}, ${input.route}, ${input.walletAddress ?? null}, ${cityId}, 0, 0, ${input.joinedAt})
    `;
    return { ...input, userNo, occupation, description, walletAddress: input.walletAddress ?? null, cityId, reputation: 0, coins: 0 };
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
    walletAddress: input.walletAddress ?? null, cityId, reputation: 0, coins: 0,
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
  name?: string; occupation?: string; description?: string; walletAddress?: string;
}): Promise<PlazaUser | null> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    if (data.name) await sql`UPDATE plaza_users SET name = ${data.name} WHERE id = ${userId}`;
    if (data.occupation !== undefined) await sql`UPDATE plaza_users SET occupation = ${data.occupation} WHERE id = ${userId}`;
    if (data.description !== undefined) await sql`UPDATE plaza_users SET description = ${data.description} WHERE id = ${userId}`;
    if (data.walletAddress !== undefined) await sql`UPDATE plaza_users SET wallet_address = ${data.walletAddress} WHERE id = ${userId}`;
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
  writeJson(USERS_FILE, users);
  return user;
}

// ============ 帖子 ============

export async function createPost(post: Omit<PlazaPost, "id" | "createdAt">): Promise<PlazaPost> {
  const id = genId("post");
  const createdAt = new Date().toISOString();
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO plaza_posts (id, user_id, user_name, user_avatar, content, created_at)
      VALUES (${id}, ${post.userId}, ${post.userName}, ${post.userAvatar}, ${post.content}, ${createdAt})`;
    return { ...post, id, createdAt };
  }
  const posts = readJson<PlazaPost[]>(POSTS_FILE, []);
  const newPost: PlazaPost = { ...post, id, createdAt };
  posts.unshift(newPost);
  writeJson(POSTS_FILE, posts);
  return newPost;
}

export async function getAllPosts(): Promise<PlazaPost[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT id, user_id, user_name, user_avatar, content, created_at FROM plaza_posts ORDER BY created_at DESC`;
    return rows.map((r) => ({
      id: r.id, userId: r.user_id, userName: r.user_name,
      userAvatar: r.user_avatar, content: r.content, createdAt: r.created_at,
    }));
  }
  return readJson<PlazaPost[]>(POSTS_FILE, []);
}

export async function getUserPosts(userId: string): Promise<PlazaPost[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT id, user_id, user_name, user_avatar, content, created_at FROM plaza_posts WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map((r) => ({
      id: r.id, userId: r.user_id, userName: r.user_name,
      userAvatar: r.user_avatar, content: r.content, createdAt: r.created_at,
    }));
  }
  return readJson<PlazaPost[]>(POSTS_FILE, []).filter((p) => p.userId === userId);
}
