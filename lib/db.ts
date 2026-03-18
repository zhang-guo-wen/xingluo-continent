import { neon } from "@neondatabase/serverless";
import { genId } from "./utils";

export type { PlazaUser, PlazaPost } from "./types";
import type { PlazaUser, PlazaPost } from "./types";

// 编号前缀
const USER_NO_PREFIX = "XL";

// ============ Postgres 模式（生产） ============

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
      reputation INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 0,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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

/** 生成下一个用户编号 */
async function nextUserNo(): Promise<string> {
  if (DATABASE_URL) {
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT COUNT(*)::int AS cnt FROM plaza_users`;
    const seq = (rows[0].cnt as number) + 1;
    return `${USER_NO_PREFIX}-${String(seq).padStart(6, "0")}`;
  }
  // 文件回退
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const seq = users.length + 1;
  return `${USER_NO_PREFIX}-${String(seq).padStart(6, "0")}`;
}

// ============ 文件回退（本地开发） ============

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson<T>(filePath: string, data: T) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ============ 导出函数 ============

/**
 * 注册或更新广场用户。
 * 新用户自动分配编号、信誉分 0、金币 0。
 * 老用户只更新 name / avatarUrl / route，不覆盖编号、信誉、金币。
 */
export async function upsertPlazaUser(
  input: Omit<PlazaUser, "userNo" | "reputation" | "coins"> & {
    occupation?: string | null;
    description?: string | null;
  }
): Promise<PlazaUser> {
  const occupation = input.occupation ?? null;
  const description = input.description ?? null;

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);

    // 先查是否已存在
    const existing = await sql`
      SELECT user_no, occupation, description, reputation, coins
      FROM plaza_users WHERE id = ${input.id}
    `;
    if (existing.length > 0) {
      // 老用户：更新基本信息，保留编号、信誉、金币
      // occupation / description 只在传入非 null 时更新
      const newOccupation = occupation ?? existing[0].occupation;
      const newDescription = description ?? existing[0].description;
      await sql`
        UPDATE plaza_users SET
          name = ${input.name},
          avatar_url = ${input.avatarUrl},
          route = ${input.route},
          occupation = ${newOccupation},
          description = ${newDescription}
        WHERE id = ${input.id}
      `;
      return {
        ...input,
        occupation: newOccupation,
        description: newDescription,
        userNo: existing[0].user_no,
        reputation: existing[0].reputation,
        coins: existing[0].coins,
      };
    }

    // 新用户：分配编号
    const userNo = await nextUserNo();
    await sql`
      INSERT INTO plaza_users (id, user_no, name, occupation, description, avatar_url, route, reputation, coins, joined_at)
      VALUES (${input.id}, ${userNo}, ${input.name}, ${occupation}, ${description}, ${input.avatarUrl}, ${input.route}, 0, 0, ${input.joinedAt})
    `;
    return { ...input, userNo, occupation, description, reputation: 0, coins: 0 };
  }

  // 文件回退
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const idx = users.findIndex((u) => u.id === input.id);
  if (idx >= 0) {
    users[idx] = {
      ...users[idx],
      name: input.name,
      avatarUrl: input.avatarUrl,
      route: input.route,
      occupation: occupation ?? users[idx].occupation,
      description: description ?? users[idx].description,
    };
    writeJson(USERS_FILE, users);
    return users[idx];
  }

  const userNo = await nextUserNo();
  const newUser: PlazaUser = { ...input, userNo, occupation, description, reputation: 0, coins: 0 };
  users.push(newUser);
  writeJson(USERS_FILE, users);
  return newUser;
}

export async function getAllPlazaUsers(): Promise<PlazaUser[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT id, user_no, name, occupation, description, avatar_url, route, reputation, coins, joined_at
      FROM plaza_users ORDER BY joined_at DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      userNo: r.user_no,
      name: r.name,
      occupation: r.occupation,
      description: r.description,
      avatarUrl: r.avatar_url,
      route: r.route,
      reputation: r.reputation,
      coins: r.coins,
      joinedAt: r.joined_at,
    }));
  }

  return readJson<PlazaUser[]>(USERS_FILE, []);
}

export async function createPost(
  post: Omit<PlazaPost, "id" | "createdAt">
): Promise<PlazaPost> {
  const id = genId("post");
  const createdAt = new Date().toISOString();

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`
      INSERT INTO plaza_posts (id, user_id, user_name, user_avatar, content, created_at)
      VALUES (${id}, ${post.userId}, ${post.userName}, ${post.userAvatar}, ${post.content}, ${createdAt})
    `;
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
    const rows = await sql`
      SELECT id, user_id, user_name, user_avatar, content, created_at
      FROM plaza_posts ORDER BY created_at DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userAvatar: r.user_avatar,
      content: r.content,
      createdAt: r.created_at,
    }));
  }

  return readJson<PlazaPost[]>(POSTS_FILE, []);
}
