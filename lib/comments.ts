import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import { addReputation } from "./economy";
import type { PostComment, PostCommentType } from "./types";

export type { PostComment };

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'comment',
      content TEXT NOT NULL,
      appeal_action TEXT,
      support_count INTEGER NOT NULL DEFAULT 0,
      oppose_count INTEGER NOT NULL DEFAULT 0,
      appeal_status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS comment_votes (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vote TEXT NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    )
  `;
  schemaReady = true;
}

const DATA_DIR = path.join(process.cwd(), "data");
function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readJson<T>(fp: string, fb: T): T { ensureDir(); if (!fs.existsSync(fp)) return fb; try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return fb; } }
function writeJson<T>(fp: string, d: T) { ensureDir(); fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf-8"); }
const COMMENTS_FILE = path.join(DATA_DIR, "post_comments.json");
const CVOTES_FILE = path.join(DATA_DIR, "comment_votes.json");

/** 获取帖子的所有评论 */
export async function getPostComments(postId: string): Promise<PostComment[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM post_comments WHERE post_id = ${postId} ORDER BY created_at ASC`;
    return rows.map(mapComment);
  }
  return readJson<PostComment[]>(COMMENTS_FILE, []).filter((c) => c.postId === postId);
}

/** 添加普通评论 */
export async function addComment(postId: string, userId: string, userName: string, content: string): Promise<PostComment> {
  const id = genId("pc");
  const now = new Date().toISOString();
  const comment: PostComment = {
    id, postId, userId, userName, type: "comment", content,
    appealAction: null, supportCount: 0, opposeCount: 0, appealStatus: null, createdAt: now,
  };
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO post_comments (id, post_id, user_id, user_name, type, content)
      VALUES (${id}, ${postId}, ${userId}, ${userName}, 'comment', ${content})`;
  } else {
    const all = readJson<PostComment[]>(COMMENTS_FILE, []);
    all.push(comment);
    writeJson(COMMENTS_FILE, all);
  }
  return comment;
}

/** 发起审议评论（信誉为0时） */
export async function addAppealComment(
  postId: string, userId: string, userName: string,
  action: "like" | "dislike", reason: string
): Promise<PostComment> {
  const id = genId("ap");
  const now = new Date().toISOString();
  const comment: PostComment = {
    id, postId, userId, userName, type: "appeal",
    content: reason, appealAction: action,
    supportCount: 0, opposeCount: 0, appealStatus: "pending", createdAt: now,
  };
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO post_comments (id, post_id, user_id, user_name, type, content, appeal_action, appeal_status)
      VALUES (${id}, ${postId}, ${userId}, ${userName}, 'appeal', ${reason}, ${action}, 'pending')`;
  } else {
    const all = readJson<PostComment[]>(COMMENTS_FILE, []);
    all.push(comment);
    writeJson(COMMENTS_FILE, all);
  }
  return comment;
}

/** 对审议评论投票（支持/反对，不消耗信誉） */
export async function voteComment(
  commentId: string, voterId: string, vote: "support" | "oppose"
): Promise<PostComment | null> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const existing = await sql`SELECT vote FROM comment_votes WHERE comment_id = ${commentId} AND user_id = ${voterId}`;
    if (existing.length > 0) return null; // 已投过

    await sql`INSERT INTO comment_votes (comment_id, user_id, vote) VALUES (${commentId}, ${voterId}, ${vote})`;
    if (vote === "support") await sql`UPDATE post_comments SET support_count = support_count + 1 WHERE id = ${commentId}`;
    else await sql`UPDATE post_comments SET oppose_count = oppose_count + 1 WHERE id = ${commentId}`;

    const [row] = await sql`SELECT * FROM post_comments WHERE id = ${commentId}`;
    if (!row || row.appeal_status !== "pending") return row ? mapComment(row) : null;

    const support = row.support_count as number;
    const oppose = row.oppose_count as number;

    if (support >= 3) {
      await sql`UPDATE post_comments SET appeal_status = 'approved' WHERE id = ${commentId}`;
      return mapComment({ ...row, appeal_status: "approved" });
    }
    if (oppose >= 3 && oppose > support) {
      await sql`UPDATE post_comments SET appeal_status = 'rejected' WHERE id = ${commentId}`;
      addReputation(row.user_id as string, -1, "appeal_rejected", commentId).catch(() => {});
      return mapComment({ ...row, appeal_status: "rejected" });
    }
    return mapComment(row);
  }

  const all = readJson<PostComment[]>(COMMENTS_FILE, []);
  const c = all.find((x) => x.id === commentId);
  if (!c || c.appealStatus !== "pending") return c ?? null;
  const votes = readJson<{ commentId: string; userId: string; vote: string }[]>(CVOTES_FILE, []);
  if (votes.some((v) => v.commentId === commentId && v.userId === voterId)) return null;
  votes.push({ commentId, userId: voterId, vote });
  if (vote === "support") c.supportCount++; else c.opposeCount++;
  if (c.supportCount >= 3) c.appealStatus = "approved";
  else if (c.opposeCount >= 3 && c.opposeCount > c.supportCount) {
    c.appealStatus = "rejected";
    addReputation(c.userId, -1, "appeal_rejected", commentId).catch(() => {});
  }
  writeJson(COMMENTS_FILE, all);
  writeJson(CVOTES_FILE, votes);
  return c;
}

function mapComment(r: Record<string, unknown>): PostComment {
  return {
    id: r.id as string, postId: r.post_id as string, userId: r.user_id as string,
    userName: r.user_name as string, type: r.type as PostCommentType, content: r.content as string,
    appealAction: (r.appeal_action as "like" | "dislike") ?? null,
    supportCount: (r.support_count as number) ?? 0, opposeCount: (r.oppose_count as number) ?? 0,
    appealStatus: (r.appeal_status as PostComment["appealStatus"]) ?? null,
    createdAt: r.created_at as string,
  };
}
