import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import { addReputation } from "./economy";
import type { UserEvent, EventAction, EventComment } from "./types";

export type { UserEvent, EventComment };

const DAILY_EVENT_LIMIT = 10;  // 每人每天最多 10 个行动
const VOTE_REPUTATION_COST = 1; // 投票消耗 1 信誉

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS user_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      ref_id TEXT,
      hash TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      dislikes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS event_votes (
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vote TEXT NOT NULL,
      PRIMARY KEY (event_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS event_comments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      content TEXT NOT NULL,
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
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const EVOTES_FILE = path.join(DATA_DIR, "event_votes.json");
const ECOMMENTS_FILE = path.join(DATA_DIR, "event_comments.json");

// ============ 哈希链 ============

function computeHash(prevHash: string, action: string, detail: string, timestamp: string): string {
  return crypto.createHash("sha256").update(`${prevHash}|${action}|${detail}|${timestamp}`).digest("hex");
}

async function getLastHash(userId: string): Promise<string> {
  if (DATABASE_URL) {
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT hash FROM user_events WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
    return rows.length > 0 ? (rows[0].hash as string) : "genesis";
  }
  const events = readJson<UserEvent[]>(EVENTS_FILE, []);
  const userEvents = events.filter((e) => e.userId === userId);
  return userEvents.length > 0 ? userEvents[userEvents.length - 1].hash : "genesis";
}

// ============ 每日行动限额 ============

export async function getDailyEventCount(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const [row] = await sql`
      SELECT COUNT(*)::int AS cnt FROM user_events
      WHERE user_id = ${userId} AND created_at::date = ${today}::date
    `;
    return row?.cnt ?? 0;
  }
  const events = readJson<UserEvent[]>(EVENTS_FILE, []);
  return events.filter((e) => e.userId === userId && e.createdAt.startsWith(today)).length;
}

export async function canAct(userId: string): Promise<boolean> {
  return (await getDailyEventCount(userId)) < DAILY_EVENT_LIMIT;
}

// ============ 记录事件 ============

export async function recordEvent(
  userId: string, userName: string, action: EventAction, detail: string, refId?: string
): Promise<UserEvent | null> {
  // 每日限额检查
  if (!(await canAct(userId))) return null;
  const id = genId("evt");
  const now = new Date().toISOString();
  const prevHash = await getLastHash(userId);
  const hash = computeHash(prevHash, action, detail, now);

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`
      INSERT INTO user_events (id, user_id, user_name, action, detail, ref_id, hash, prev_hash, created_at)
      VALUES (${id}, ${userId}, ${userName}, ${action}, ${detail}, ${refId ?? null}, ${hash}, ${prevHash}, ${now})
    `;
  } else {
    const events = readJson<UserEvent[]>(EVENTS_FILE, []);
    events.push({ id, userId, userName, action, detail, refId: refId ?? null, hash, prevHash, likes: 0, dislikes: 0, createdAt: now });
    writeJson(EVENTS_FILE, events);
  }

  return { id, userId, userName, action, detail, refId: refId ?? null, hash, prevHash, likes: 0, dislikes: 0, createdAt: now };
}

// ============ 查询事件 ============

export async function getUserEvents(userId: string, limit = 50): Promise<UserEvent[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM user_events WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(mapEvent);
  }
  return readJson<UserEvent[]>(EVENTS_FILE, []).filter((e) => e.userId === userId).reverse().slice(0, limit);
}

export async function getAllEvents(limit = 100): Promise<UserEvent[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM user_events ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(mapEvent);
  }
  return readJson<UserEvent[]>(EVENTS_FILE, []).reverse().slice(0, limit);
}

// ============ 事件投票 ============

export async function voteEvent(
  eventId: string, userId: string, vote: "like" | "dislike"
): Promise<{ likes: number; dislikes: number; userVote: string | null }> {
  // 投票消耗 1 信誉（投票者）
  await addReputation(userId, -VOTE_REPUTATION_COST, "event_vote_cost", eventId);
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    // 查现有投票
    const existing = await sql`SELECT vote FROM event_votes WHERE event_id = ${eventId} AND user_id = ${userId}`;
    if (existing.length > 0) {
      if (existing[0].vote === vote) {
        // 取消投票
        await sql`DELETE FROM event_votes WHERE event_id = ${eventId} AND user_id = ${userId}`;
        await sql`UPDATE user_events SET ${vote === "like" ? sql`likes = likes - 1` : sql`dislikes = dislikes - 1`} WHERE id = ${eventId}`;
      } else {
        // 切换投票
        const oldVote = existing[0].vote as string;
        await sql`UPDATE event_votes SET vote = ${vote} WHERE event_id = ${eventId} AND user_id = ${userId}`;
        if (oldVote === "like") await sql`UPDATE user_events SET likes = likes - 1, dislikes = dislikes + 1 WHERE id = ${eventId}`;
        else await sql`UPDATE user_events SET dislikes = dislikes - 1, likes = likes + 1 WHERE id = ${eventId}`;
      }
    } else {
      await sql`INSERT INTO event_votes (event_id, user_id, vote) VALUES (${eventId}, ${userId}, ${vote})`;
      await sql`UPDATE user_events SET ${vote === "like" ? sql`likes = likes + 1` : sql`dislikes = dislikes + 1`} WHERE id = ${eventId}`;
    }
    // 返回最新计数
    const [row] = await sql`SELECT likes, dislikes, user_id FROM user_events WHERE id = ${eventId}`;
    const [uv] = await sql`SELECT vote FROM event_votes WHERE event_id = ${eventId} AND user_id = ${userId}`;
    // 事件所有者收到投票时积累 1 信誉
    if (row?.user_id && row.user_id !== userId) {
      addReputation(row.user_id as string, 1, "event_voted", eventId).catch(() => {});
    }
    return { likes: row?.likes ?? 0, dislikes: row?.dislikes ?? 0, userVote: uv?.vote ?? null };
  }

  // 文件回退
  const events = readJson<UserEvent[]>(EVENTS_FILE, []);
  const votes = readJson<{ eventId: string; userId: string; vote: string }[]>(EVOTES_FILE, []);
  const evt = events.find((e) => e.id === eventId);
  if (!evt) return { likes: 0, dislikes: 0, userVote: null };

  const existIdx = votes.findIndex((v) => v.eventId === eventId && v.userId === userId);
  if (existIdx >= 0) {
    if (votes[existIdx].vote === vote) {
      if (vote === "like") evt.likes--; else evt.dislikes--;
      votes.splice(existIdx, 1);
    } else {
      if (votes[existIdx].vote === "like") { evt.likes--; evt.dislikes++; }
      else { evt.dislikes--; evt.likes++; }
      votes[existIdx].vote = vote;
    }
  } else {
    if (vote === "like") evt.likes++; else evt.dislikes++;
    votes.push({ eventId, userId, vote });
  }
  writeJson(EVENTS_FILE, events);
  writeJson(EVOTES_FILE, votes);
  const uv = votes.find((v) => v.eventId === eventId && v.userId === userId);
  // 事件所有者收到投票时积累 1 信誉
  if (evt.userId !== userId) {
    addReputation(evt.userId, 1, "event_voted", eventId).catch(() => {});
  }
  return { likes: evt.likes, dislikes: evt.dislikes, userVote: uv?.vote ?? null };
}

// ============ 事件评论 ============

export async function addEventComment(
  eventId: string, userId: string, userName: string, content: string
): Promise<EventComment> {
  const id = genId("ec");
  const now = new Date().toISOString();
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO event_comments (id, event_id, user_id, user_name, content, created_at)
      VALUES (${id}, ${eventId}, ${userId}, ${userName}, ${content}, ${now})`;
  } else {
    const comments = readJson<EventComment[]>(ECOMMENTS_FILE, []);
    comments.push({ id, eventId, userId, userName, content, createdAt: now });
    writeJson(ECOMMENTS_FILE, comments);
  }
  return { id, eventId, userId, userName, content, createdAt: now };
}

export async function getEventComments(eventId: string): Promise<EventComment[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM event_comments WHERE event_id = ${eventId} ORDER BY created_at ASC`;
    return rows.map((r) => ({
      id: r.id, eventId: r.event_id, userId: r.user_id,
      userName: r.user_name, content: r.content, createdAt: r.created_at,
    }));
  }
  return readJson<EventComment[]>(ECOMMENTS_FILE, []).filter((c) => c.eventId === eventId);
}

function mapEvent(r: Record<string, unknown>): UserEvent {
  return {
    id: r.id as string, userId: r.user_id as string, userName: r.user_name as string,
    action: r.action as EventAction, detail: r.detail as string,
    refId: r.ref_id as string | null, hash: r.hash as string, prevHash: r.prev_hash as string,
    likes: (r.likes as number) ?? 0, dislikes: (r.dislikes as number) ?? 0,
    createdAt: r.created_at as string,
  };
}
