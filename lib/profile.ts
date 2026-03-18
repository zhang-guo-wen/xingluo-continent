import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import type { UserSkill, UserItem, UserTask, ItemCategory, ItemStatus, TaskStatus } from "./types";

export type { UserSkill, UserItem, UserTask };

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS user_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'goods',
      price REAL NOT NULL DEFAULT 0,
      token_symbol TEXT NOT NULL DEFAULT 'XLC',
      status TEXT NOT NULL DEFAULT 'on_sale',
      buyer_id TEXT,
      tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      reward REAL NOT NULL DEFAULT 0,
      token_symbol TEXT NOT NULL DEFAULT 'XLC',
      status TEXT NOT NULL DEFAULT 'open',
      assignee_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

// ============ 文件回退 ============

const DATA_DIR = path.join(process.cwd(), "data");
function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readJson<T>(fp: string, fb: T): T {
  ensureDir(); if (!fs.existsSync(fp)) return fb;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return fb; }
}
function writeJson<T>(fp: string, d: T) { ensureDir(); fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf-8"); }

const SKILLS_FILE = path.join(DATA_DIR, "skills.json");
const ITEMS_FILE = path.join(DATA_DIR, "items.json");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

// ============ 技能 ============

export async function getUserSkills(userId: string): Promise<UserSkill[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM user_skills WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map((r) => ({ id: r.id, userId: r.user_id, name: r.name, description: r.description, createdAt: r.created_at }));
  }
  return readJson<UserSkill[]>(SKILLS_FILE, []).filter((s) => s.userId === userId);
}

export async function addSkill(userId: string, name: string, description?: string): Promise<UserSkill> {
  const id = genId("skill");
  const now = new Date().toISOString();
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO user_skills (id, user_id, name, description) VALUES (${id}, ${userId}, ${name}, ${description ?? null})`;
  } else {
    const all = readJson<UserSkill[]>(SKILLS_FILE, []);
    all.push({ id, userId, name, description: description ?? null, createdAt: now });
    writeJson(SKILLS_FILE, all);
  }
  return { id, userId, name, description: description ?? null, createdAt: now };
}

export async function removeSkill(skillId: string, userId: string): Promise<boolean> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`DELETE FROM user_skills WHERE id = ${skillId} AND user_id = ${userId}`;
    return true;
  }
  const all = readJson<UserSkill[]>(SKILLS_FILE, []);
  const idx = all.findIndex((s) => s.id === skillId && s.userId === userId);
  if (idx < 0) return false;
  all.splice(idx, 1);
  writeJson(SKILLS_FILE, all);
  return true;
}

// ============ 商品 ============

export async function getUserItems(userId: string): Promise<UserItem[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM user_items WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map(mapItem);
  }
  return readJson<UserItem[]>(ITEMS_FILE, []).filter((i) => i.userId === userId);
}

export async function getMarketItems(category?: ItemCategory, limit = 50): Promise<UserItem[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = category
      ? await sql`SELECT * FROM user_items WHERE status = 'on_sale' AND category = ${category} ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM user_items WHERE status = 'on_sale' ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(mapItem);
  }
  const all = readJson<UserItem[]>(ITEMS_FILE, []).filter((i) => i.status === "on_sale");
  const filtered = category ? all.filter((i) => i.category === category) : all;
  return filtered.slice(0, limit);
}

export async function createItem(input: {
  userId: string; name: string; description?: string;
  category: ItemCategory; price: number; tokenSymbol?: string;
}): Promise<UserItem> {
  const id = genId("item");
  const now = new Date().toISOString();
  const item: UserItem = {
    id, userId: input.userId, name: input.name,
    description: input.description ?? null,
    category: input.category, price: input.price,
    tokenSymbol: input.tokenSymbol ?? "XLC",
    status: "on_sale", buyerId: null, txHash: null, createdAt: now,
  };
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO user_items (id, user_id, name, description, category, price, token_symbol, status)
      VALUES (${id}, ${item.userId}, ${item.name}, ${item.description}, ${item.category}, ${item.price}, ${item.tokenSymbol}, 'on_sale')`;
  } else {
    const all = readJson<UserItem[]>(ITEMS_FILE, []);
    all.push(item);
    writeJson(ITEMS_FILE, all);
  }
  return item;
}

export async function buyItem(itemId: string, buyerId: string, txHash?: string): Promise<UserItem | null> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const [row] = await sql`SELECT * FROM user_items WHERE id = ${itemId} AND status = 'on_sale'`;
    if (!row) return null;
    await sql`UPDATE user_items SET status = 'sold', buyer_id = ${buyerId}, tx_hash = ${txHash ?? null} WHERE id = ${itemId}`;
    return { ...mapItem(row), status: "sold", buyerId, txHash: txHash ?? null };
  }
  const all = readJson<UserItem[]>(ITEMS_FILE, []);
  const item = all.find((i) => i.id === itemId && i.status === "on_sale");
  if (!item) return null;
  item.status = "sold";
  item.buyerId = buyerId;
  item.txHash = txHash ?? null;
  writeJson(ITEMS_FILE, all);
  return item;
}

// ============ 任务 ============

export async function getUserTasks(userId: string): Promise<UserTask[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM user_tasks WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map(mapTask);
  }
  return readJson<UserTask[]>(TASKS_FILE, []).filter((t) => t.userId === userId);
}

export async function getOpenTasks(limit = 50): Promise<UserTask[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM user_tasks WHERE status = 'open' ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(mapTask);
  }
  return readJson<UserTask[]>(TASKS_FILE, []).filter((t) => t.status === "open").slice(0, limit);
}

export async function createTask(input: {
  userId: string; title: string; description?: string;
  reward: number; tokenSymbol?: string;
}): Promise<UserTask> {
  const id = genId("task");
  const now = new Date().toISOString();
  const task: UserTask = {
    id, userId: input.userId, title: input.title,
    description: input.description ?? null,
    reward: input.reward, tokenSymbol: input.tokenSymbol ?? "XLC",
    status: "open", assigneeId: null, createdAt: now,
  };
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO user_tasks (id, user_id, title, description, reward, token_symbol, status)
      VALUES (${id}, ${task.userId}, ${task.title}, ${task.description}, ${task.reward}, ${task.tokenSymbol}, 'open')`;
  } else {
    const all = readJson<UserTask[]>(TASKS_FILE, []);
    all.push(task);
    writeJson(TASKS_FILE, all);
  }
  return task;
}

export async function updateTaskStatus(taskId: string, userId: string, status: TaskStatus, assigneeId?: string): Promise<boolean> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE user_tasks SET status = ${status}, assignee_id = ${assigneeId ?? null} WHERE id = ${taskId} AND user_id = ${userId}`;
    return true;
  }
  const all = readJson<UserTask[]>(TASKS_FILE, []);
  const task = all.find((t) => t.id === taskId && t.userId === userId);
  if (!task) return false;
  task.status = status;
  if (assigneeId) task.assigneeId = assigneeId;
  writeJson(TASKS_FILE, all);
  return true;
}

// ============ 映射 ============

function mapItem(r: Record<string, unknown>): UserItem {
  return {
    id: r.id as string, userId: r.user_id as string, name: r.name as string,
    description: r.description as string | null, category: r.category as ItemCategory,
    price: r.price as number, tokenSymbol: r.token_symbol as string,
    status: r.status as ItemStatus, buyerId: r.buyer_id as string | null,
    txHash: r.tx_hash as string | null, createdAt: r.created_at as string,
  };
}

function mapTask(r: Record<string, unknown>): UserTask {
  return {
    id: r.id as string, userId: r.user_id as string, title: r.title as string,
    description: r.description as string | null, reward: r.reward as number,
    tokenSymbol: r.token_symbol as string, status: r.status as TaskStatus,
    assigneeId: r.assignee_id as string | null, createdAt: r.created_at as string,
  };
}
