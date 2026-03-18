import fs from "fs";
import path from "path";

// Vercel Serverless 只有 /tmp 可写；本地开发用项目目录
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "plaza-data")
  : path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

export interface PlazaUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  route: string | null;
  joinedAt: string;
}

export interface PlazaPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

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

/** 注册或更新广场用户 */
export function upsertPlazaUser(user: PlazaUser): PlazaUser {
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user, joinedAt: users[idx].joinedAt };
  } else {
    users.push(user);
  }
  writeJson(USERS_FILE, users);
  return user;
}

/** 获取所有广场用户 */
export function getAllPlazaUsers(): PlazaUser[] {
  return readJson<PlazaUser[]>(USERS_FILE, []);
}

/** 创建帖子 */
export function createPost(
  post: Omit<PlazaPost, "id" | "createdAt">
): PlazaPost {
  const posts = readJson<PlazaPost[]>(POSTS_FILE, []);
  const newPost: PlazaPost = {
    ...post,
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  posts.unshift(newPost);
  writeJson(POSTS_FILE, posts);
  return newPost;
}

/** 获取所有帖子（最新的在前） */
export function getAllPosts(): PlazaPost[] {
  return readJson<PlazaPost[]>(POSTS_FILE, []);
}
