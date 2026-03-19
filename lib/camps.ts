import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import type { Camp, CampVisibility, CampJoinRequest, CampFollow, UserFriend } from "./types";

export type { Camp, CampJoinRequest, CampFollow, UserFriend };

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

const CAMP_CAPACITY = 256;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS camps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      owner_id TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 256,
      city_id TEXT NOT NULL DEFAULT 'xingluo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS camp_join_requests (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (camp_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS camp_follows (
      user_id TEXT NOT NULL,
      camp_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, camp_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_friends (
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id)
    )
  `;
  // 用户表加营地相关列
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS camp_id TEXT`.catch(() => {});
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`.catch(() => {});

  // 默认营地
  await sql`
    INSERT INTO camps (id, name, description, visibility, owner_id, owner_name, city_id)
    VALUES ('camp_default', '星罗营地', '所有冒险者的起始营地', 'public', 'system', '系统', 'xingluo')
    ON CONFLICT (id) DO NOTHING
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
const CAMPS_FILE = path.join(DATA_DIR, "camps.json");
const REQUESTS_FILE = path.join(DATA_DIR, "camp_requests.json");

const DEFAULT_CAMP: Camp = {
  id: "camp_default", name: "星罗营地", description: "所有冒险者的起始营地",
  visibility: "public", ownerId: "system", ownerName: "系统",
  capacity: CAMP_CAPACITY, memberCount: 0, cityId: "xingluo",
  createdAt: new Date().toISOString(),
};

// ============ 营地 CRUD ============

export async function getAllCamps(cityId?: string): Promise<Camp[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = cityId
      ? await sql`SELECT c.*, COALESCE((SELECT COUNT(*)::int FROM plaza_users u WHERE u.camp_id = c.id AND u.is_online = true), 0) AS member_count FROM camps c WHERE c.city_id = ${cityId} ORDER BY c.created_at ASC`
      : await sql`SELECT c.*, COALESCE((SELECT COUNT(*)::int FROM plaza_users u WHERE u.camp_id = c.id AND u.is_online = true), 0) AS member_count FROM camps c ORDER BY c.created_at ASC`;
    return rows.map(mapCamp);
  }
  const camps = readJson<Camp[]>(CAMPS_FILE, [DEFAULT_CAMP]);
  if (camps.length === 0) { camps.push(DEFAULT_CAMP); writeJson(CAMPS_FILE, camps); }
  return cityId ? camps.filter((c) => c.cityId === cityId) : camps;
}

export async function getCamp(campId: string): Promise<Camp | null> {
  const all = await getAllCamps();
  return all.find((c) => c.id === campId) ?? null;
}

export async function createCamp(input: {
  name: string; description?: string; visibility: CampVisibility;
  ownerId: string; ownerName: string; cityId?: string;
}): Promise<Camp> {
  const id = genId("camp");
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO camps (id, name, description, visibility, owner_id, owner_name, city_id)
      VALUES (${id}, ${input.name}, ${input.description ?? null}, ${input.visibility},
              ${input.ownerId}, ${input.ownerName}, ${input.cityId ?? "xingluo"})`;
    // 创建者自动加入
    await sql`UPDATE plaza_users SET camp_id = ${id}, is_online = true WHERE id = ${input.ownerId}`;
  } else {
    const camps = readJson<Camp[]>(CAMPS_FILE, [DEFAULT_CAMP]);
    camps.push({
      id, name: input.name, description: input.description ?? null,
      visibility: input.visibility, ownerId: input.ownerId, ownerName: input.ownerName,
      capacity: CAMP_CAPACITY, memberCount: 1, cityId: input.cityId ?? "xingluo",
      createdAt: new Date().toISOString(),
    });
    writeJson(CAMPS_FILE, camps);
  }
  return (await getCamp(id))!;
}

// ============ 加入/离开营地 ============

/** 分配用户到随机有空位的公开营地 */
export async function assignRandomCamp(userId: string): Promise<string> {
  const camps = await getAllCamps();
  const publicCamps = camps.filter((c) => c.visibility === "public" && c.memberCount < c.capacity);

  let targetId: string;
  if (publicCamps.length > 0) {
    // 优先快满的营地
    publicCamps.sort((a, b) => b.memberCount - a.memberCount);
    targetId = publicCamps[0].id;
  } else {
    targetId = "camp_default";
  }

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE plaza_users SET camp_id = ${targetId}, is_online = true, last_seen_at = NOW() WHERE id = ${userId}`;
  }
  return targetId;
}

/** 加入指定营地（公开直接加，私人需申请） */
export async function joinCamp(campId: string, userId: string, userName: string): Promise<{ joined: boolean; needApproval: boolean }> {
  const camp = await getCamp(campId);
  if (!camp) return { joined: false, needApproval: false };

  if (camp.visibility === "private") {
    // 提交申请
    if (DATABASE_URL) {
      await ensureSchema();
      const sql = neon(DATABASE_URL);
      await sql`INSERT INTO camp_join_requests (id, camp_id, user_id, user_name)
        VALUES (${genId("req")}, ${campId}, ${userId}, ${userName})
        ON CONFLICT (camp_id, user_id) DO NOTHING`;
    } else {
      const reqs = readJson<CampJoinRequest[]>(REQUESTS_FILE, []);
      if (!reqs.some((r) => r.campId === campId && r.userId === userId)) {
        reqs.push({ id: genId("req"), campId, userId, userName, status: "pending", createdAt: new Date().toISOString() });
        writeJson(REQUESTS_FILE, reqs);
      }
    }
    return { joined: false, needApproval: true };
  }

  // 公开营地直接加入
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE plaza_users SET camp_id = ${campId}, is_online = true, last_seen_at = NOW() WHERE id = ${userId}`;
  }
  return { joined: true, needApproval: false };
}

/** 离开营地（掉线 → 分配随机营地） */
export async function leaveCamp(userId: string): Promise<string> {
  return assignRandomCamp(userId);
}

/** 标记上线 */
export async function markOnline(userId: string): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE plaza_users SET is_online = true, last_seen_at = NOW() WHERE id = ${userId}`;
  }
}

/** 处理加入申请 */
export async function handleJoinRequest(requestId: string, ownerId: string, approve: boolean): Promise<boolean> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const [req] = await sql`SELECT * FROM camp_join_requests WHERE id = ${requestId}`;
    if (!req) return false;
    const [camp] = await sql`SELECT owner_id FROM camps WHERE id = ${req.camp_id}`;
    if (!camp || camp.owner_id !== ownerId) return false;

    const newStatus = approve ? "approved" : "rejected";
    await sql`UPDATE camp_join_requests SET status = ${newStatus} WHERE id = ${requestId}`;
    if (approve) {
      await sql`UPDATE plaza_users SET camp_id = ${req.camp_id}, is_online = true WHERE id = ${req.user_id}`;
    }
    return true;
  }
  return false;
}

/** 获取营地成员（仅在线） */
export async function getCampMembers(campId: string): Promise<string[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT id FROM plaza_users WHERE camp_id = ${campId} AND is_online = true`;
    return rows.map((r) => r.id as string);
  }
  return [];
}

/** 获取营地加入申请 */
export async function getCampRequests(campId: string): Promise<CampJoinRequest[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`SELECT * FROM camp_join_requests WHERE camp_id = ${campId} AND status = 'pending' ORDER BY created_at ASC`;
    return rows.map((r) => ({
      id: r.id, campId: r.camp_id, userId: r.user_id,
      userName: r.user_name, status: r.status as "pending", createdAt: r.created_at,
    }));
  }
  return readJson<CampJoinRequest[]>(REQUESTS_FILE, []).filter((r) => r.campId === campId && r.status === "pending");
}

// ============ 营地关注 ============

export async function followCamp(userId: string, campId: string): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO camp_follows (user_id, camp_id) VALUES (${userId}, ${campId}) ON CONFLICT DO NOTHING`;
  }
}

export async function unfollowCamp(userId: string, campId: string): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`DELETE FROM camp_follows WHERE user_id = ${userId} AND camp_id = ${campId}`;
  }
}

export async function getFollowedCamps(userId: string): Promise<CampFollow[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT cf.user_id, cf.camp_id, c.name AS camp_name, cf.created_at
      FROM camp_follows cf JOIN camps c ON cf.camp_id = c.id
      WHERE cf.user_id = ${userId} ORDER BY cf.created_at DESC
    `;
    return rows.map((r) => ({ userId: r.user_id, campId: r.camp_id, campName: r.camp_name, createdAt: r.created_at }));
  }
  return [];
}

// ============ 好友 ============

export async function addFriend(userId: string, friendId: string): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    // 双向添加
    await sql`INSERT INTO user_friends (user_id, friend_id) VALUES (${userId}, ${friendId}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO user_friends (user_id, friend_id) VALUES (${friendId}, ${userId}) ON CONFLICT DO NOTHING`;
  }
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`DELETE FROM user_friends WHERE user_id = ${userId} AND friend_id = ${friendId}`;
    await sql`DELETE FROM user_friends WHERE user_id = ${friendId} AND friend_id = ${userId}`;
  }
}

export async function getFriends(userId: string): Promise<UserFriend[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT uf.user_id, uf.friend_id, u.name AS friend_name, uf.created_at
      FROM user_friends uf JOIN plaza_users u ON uf.friend_id = u.id
      WHERE uf.user_id = ${userId} ORDER BY uf.created_at DESC
    `;
    return rows.map((r) => ({ userId: r.user_id, friendId: r.friend_id, friendName: r.friend_name, createdAt: r.created_at }));
  }
  return [];
}

function mapCamp(r: Record<string, unknown>): Camp {
  return {
    id: r.id as string, name: r.name as string, description: r.description as string | null,
    visibility: r.visibility as CampVisibility, ownerId: r.owner_id as string,
    ownerName: r.owner_name as string, capacity: r.capacity as number,
    memberCount: (r.member_count as number) ?? 0, cityId: r.city_id as string,
    createdAt: r.created_at as string,
  };
}
