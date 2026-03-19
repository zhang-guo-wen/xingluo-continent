import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import { addReputation } from "./economy";
import type { ReputationAppeal } from "./types";

export type { ReputationAppeal };

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS reputation_appeals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      target_post_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      support_count INTEGER NOT NULL DEFAULT 0,
      oppose_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS appeal_votes (
      appeal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vote TEXT NOT NULL,
      PRIMARY KEY (appeal_id, user_id)
    )
  `;
  schemaReady = true;
}

// 文件回退
const DATA_DIR = path.join(process.cwd(), "data");
function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readJson<T>(fp: string, fb: T): T {
  ensureDir(); if (!fs.existsSync(fp)) return fb;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return fb; }
}
function writeJson<T>(fp: string, d: T) { ensureDir(); fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf-8"); }
const APPEALS_FILE = path.join(DATA_DIR, "appeals.json");
const AVOTES_FILE = path.join(DATA_DIR, "appeal_votes.json");

/** 发起信誉审议 */
export async function createAppeal(input: {
  userId: string; userName: string; targetPostId: string;
  action: "like" | "dislike"; reason: string;
}): Promise<ReputationAppeal> {
  const id = genId("appeal");
  const now = new Date().toISOString();
  const appeal: ReputationAppeal = {
    id, userId: input.userId, userName: input.userName,
    targetPostId: input.targetPostId, action: input.action,
    reason: input.reason, supportCount: 0, opposeCount: 0,
    status: "pending", createdAt: now,
  };

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO reputation_appeals (id, user_id, user_name, target_post_id, action, reason)
      VALUES (${id}, ${input.userId}, ${input.userName}, ${input.targetPostId}, ${input.action}, ${input.reason})`;
  } else {
    const all = readJson<ReputationAppeal[]>(APPEALS_FILE, []);
    all.push(appeal);
    writeJson(APPEALS_FILE, all);
  }
  return appeal;
}

/** 获取待审议列表 */
export async function getPendingAppeals(limit = 20): Promise<ReputationAppeal[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM reputation_appeals WHERE status = 'pending' ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(mapAppeal);
  }
  return readJson<ReputationAppeal[]>(APPEALS_FILE, []).filter((a) => a.status === "pending").slice(0, limit);
}

/** 对审议投票（支持/反对） */
export async function voteAppeal(
  appealId: string, voterId: string, vote: "support" | "oppose"
): Promise<ReputationAppeal | null> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    // 防重复
    const existing = await sql`SELECT vote FROM appeal_votes WHERE appeal_id = ${appealId} AND user_id = ${voterId}`;
    if (existing.length > 0) return null;

    await sql`INSERT INTO appeal_votes (appeal_id, user_id, vote) VALUES (${appealId}, ${voterId}, ${vote})`;
    if (vote === "support") {
      await sql`UPDATE reputation_appeals SET support_count = support_count + 1 WHERE id = ${appealId}`;
    } else {
      await sql`UPDATE reputation_appeals SET oppose_count = oppose_count + 1 WHERE id = ${appealId}`;
    }

    // 检查是否达成判决
    const [row] = await sql`SELECT * FROM reputation_appeals WHERE id = ${appealId}`;
    if (!row || row.status !== "pending") return row ? mapAppeal(row) : null;

    const support = row.support_count as number;
    const oppose = row.oppose_count as number;

    // 支持 >= 3：审议通过，执行原操作
    if (support >= 3) {
      await sql`UPDATE reputation_appeals SET status = 'approved' WHERE id = ${appealId}`;
      return mapAppeal({ ...row, status: "approved", support_count: support });
    }
    // 反对 > 支持 且 反对 >= 3：审议失败，扣信誉
    if (oppose >= 3 && oppose > support) {
      await sql`UPDATE reputation_appeals SET status = 'rejected' WHERE id = ${appealId}`;
      await addReputation(row.user_id as string, -1, "appeal_rejected", appealId);
      return mapAppeal({ ...row, status: "rejected", oppose_count: oppose });
    }

    return mapAppeal(row);
  }

  // 文件回退
  const appeals = readJson<ReputationAppeal[]>(APPEALS_FILE, []);
  const appeal = appeals.find((a) => a.id === appealId);
  if (!appeal || appeal.status !== "pending") return appeal ?? null;
  const votes = readJson<{ appealId: string; userId: string; vote: string }[]>(AVOTES_FILE, []);
  if (votes.some((v) => v.appealId === appealId && v.userId === voterId)) return null;
  votes.push({ appealId, userId: voterId, vote });
  if (vote === "support") appeal.supportCount++;
  else appeal.opposeCount++;
  if (appeal.supportCount >= 3) appeal.status = "approved";
  else if (appeal.opposeCount >= 3 && appeal.opposeCount > appeal.supportCount) {
    appeal.status = "rejected";
    addReputation(appeal.userId, -1, "appeal_rejected", appealId).catch(() => {});
  }
  writeJson(APPEALS_FILE, appeals);
  writeJson(AVOTES_FILE, votes);
  return appeal;
}

function mapAppeal(r: Record<string, unknown>): ReputationAppeal {
  return {
    id: r.id as string, userId: r.user_id as string, userName: r.user_name as string,
    targetPostId: r.target_post_id as string, action: r.action as "like" | "dislike",
    reason: r.reason as string, supportCount: r.support_count as number,
    opposeCount: r.oppose_count as number, status: r.status as ReputationAppeal["status"],
    createdAt: r.created_at as string,
  };
}
