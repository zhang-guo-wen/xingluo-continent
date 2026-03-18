import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { genId } from "./utils";

export type { Zone, ZoneVote } from "./types";
import type { Zone, ZoneVote } from "./types";

// ============ 默认区域 ============

const DEFAULT_ZONE: Zone = {
  id: "default",
  name: "星罗广场",
  description: "所有冒险者的起点",
  color: "#4a9c5d",
  icon: "castle",
  gridX: 7,
  gridY: 5,
  gridW: 6,
  gridH: 5,
  creatorId: "system",
  status: "active",
  voteDeadline: null,
  approveCount: 0,
  rejectCount: 0,
  createdAt: new Date().toISOString(),
};

// ============ Postgres ============

const DATABASE_URL = process.env.DATABASE_URL;

let zoneSchemaReady = false;

async function ensureZoneSchema() {
  if (!DATABASE_URL || zoneSchemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS plaza_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#4a9c5d',
      icon TEXT NOT NULL DEFAULT 'house',
      grid_x INTEGER NOT NULL DEFAULT 0,
      grid_y INTEGER NOT NULL DEFAULT 0,
      grid_w INTEGER NOT NULL DEFAULT 3,
      grid_h INTEGER NOT NULL DEFAULT 3,
      creator_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'voting',
      vote_deadline TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS plaza_zone_votes (
      id TEXT PRIMARY KEY,
      zone_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vote TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (zone_id, user_id)
    )
  `;
  // 确保默认区域存在
  await sql`
    INSERT INTO plaza_zones (id, name, description, color, icon, grid_x, grid_y, grid_w, grid_h, creator_id, status)
    VALUES ('default', '星罗广场', '所有冒险者的起点', '#4a9c5d', 'castle', 7, 5, 6, 5, 'system', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  zoneSchemaReady = true;
}

// ============ 文件回退 ============

const DATA_DIR = path.join(process.cwd(), "data");
const ZONES_FILE = path.join(DATA_DIR, "zones.json");
const VOTES_FILE = path.join(DATA_DIR, "zone_votes.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(fp: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(fp)) return fallback;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return fallback; }
}

function writeJson<T>(fp: string, data: T) {
  ensureDir();
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

// ============ 导出函数 ============

export async function getAllZones(): Promise<Zone[]> {
  if (DATABASE_URL) {
    await ensureZoneSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT z.*,
        COALESCE((SELECT COUNT(*) FROM plaza_zone_votes v WHERE v.zone_id = z.id AND v.vote = 'approve'), 0)::int AS approve_count,
        COALESCE((SELECT COUNT(*) FROM plaza_zone_votes v WHERE v.zone_id = z.id AND v.vote = 'reject'), 0)::int AS reject_count
      FROM plaza_zones z
      ORDER BY z.created_at ASC
    `;
    return rows.map(mapZoneRow);
  }

  const zones = readJson<Zone[]>(ZONES_FILE, [DEFAULT_ZONE]);
  if (zones.length === 0) {
    zones.push(DEFAULT_ZONE);
    writeJson(ZONES_FILE, zones);
  }
  return zones;
}

export async function proposeZone(input: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  creatorId: string;
}): Promise<Zone> {
  const id = genId("zone");
  const deadline = new Date(Date.now() + 72 * 3600_000).toISOString();
  const pos = await findFreePosition();

  if (DATABASE_URL) {
    await ensureZoneSchema();
    const sql = neon(DATABASE_URL);
    await sql`
      INSERT INTO plaza_zones (id, name, description, color, icon, grid_x, grid_y, grid_w, grid_h, creator_id, status, vote_deadline)
      VALUES (${id}, ${input.name}, ${input.description ?? null}, ${input.color ?? "#6b8cff"},
              ${input.icon ?? "house"}, ${pos.x}, ${pos.y}, 4, 3, ${input.creatorId}, 'voting', ${deadline})
    `;
    return {
      id, name: input.name, description: input.description ?? null,
      color: input.color ?? "#6b8cff", icon: input.icon ?? "house",
      gridX: pos.x, gridY: pos.y, gridW: 4, gridH: 3,
      creatorId: input.creatorId, status: "voting",
      voteDeadline: deadline, approveCount: 0, rejectCount: 0,
      createdAt: new Date().toISOString(),
    };
  }

  const zones = readJson<Zone[]>(ZONES_FILE, [DEFAULT_ZONE]);
  const zone: Zone = {
    id, name: input.name, description: input.description ?? null,
    color: input.color ?? "#6b8cff", icon: input.icon ?? "house",
    gridX: pos.x, gridY: pos.y, gridW: 4, gridH: 3,
    creatorId: input.creatorId, status: "voting",
    voteDeadline: deadline, approveCount: 0, rejectCount: 0,
    createdAt: new Date().toISOString(),
  };
  zones.push(zone);
  writeJson(ZONES_FILE, zones);
  return zone;
}

export async function voteForZone(
  zoneId: string, userId: string, vote: "approve" | "reject"
): Promise<{ zone: Zone; activated: boolean }> {
  const vid = genId("vote");

  if (DATABASE_URL) {
    await ensureZoneSchema();
    const sql = neon(DATABASE_URL);
    await sql`
      INSERT INTO plaza_zone_votes (id, zone_id, user_id, vote, created_at)
      VALUES (${vid}, ${zoneId}, ${userId}, ${vote}, NOW())
      ON CONFLICT (zone_id, user_id) DO UPDATE SET vote = EXCLUDED.vote
    `;
    const activated = await checkAndActivateZone(zoneId);
    const zones = await getAllZones();
    const zone = zones.find((z) => z.id === zoneId)!;
    return { zone, activated };
  }

  const votes = readJson<ZoneVote[]>(VOTES_FILE, []);
  const idx = votes.findIndex((v) => v.zoneId === zoneId && v.userId === userId);
  if (idx >= 0) {
    votes[idx].vote = vote;
  } else {
    votes.push({ id: vid, zoneId, userId, vote, createdAt: new Date().toISOString() });
  }
  writeJson(VOTES_FILE, votes);

  const activated = await checkAndActivateZone(zoneId);
  const zones = await getAllZones();
  const zone = zones.find((z) => z.id === zoneId)!;
  return { zone, activated };
}

async function checkAndActivateZone(zoneId: string): Promise<boolean> {
  if (DATABASE_URL) {
    const sql = neon(DATABASE_URL);
    const [zoneRow] = await sql`SELECT status FROM plaza_zones WHERE id = ${zoneId}`;
    if (!zoneRow || zoneRow.status !== "voting") return false;

    const [{ cnt: totalUsers }] = await sql`SELECT COUNT(*)::int AS cnt FROM plaza_users`;
    const [{ cnt: approves }] = await sql`
      SELECT COUNT(*)::int AS cnt FROM plaza_zone_votes WHERE zone_id = ${zoneId} AND vote = 'approve'
    `;
    const threshold = Math.max(1, Math.ceil(totalUsers * 0.1));
    if (approves >= threshold) {
      await sql`UPDATE plaza_zones SET status = 'active' WHERE id = ${zoneId}`;
      return true;
    }
    return false;
  }

  const zones = readJson<Zone[]>(ZONES_FILE, []);
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone || zone.status !== "voting") return false;

  const votes = readJson<ZoneVote[]>(VOTES_FILE, []);
  const approves = votes.filter((v) => v.zoneId === zoneId && v.vote === "approve").length;

  // 本地开发简化：文件模式下用 zones 里的用户数
  const usersFile = path.join(DATA_DIR, "users.json");
  let totalUsers = 1;
  try {
    const users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
    totalUsers = users.length || 1;
  } catch {}

  const threshold = Math.max(1, Math.ceil(totalUsers * 0.1));
  if (approves >= threshold) {
    zone.status = "active";
    writeJson(ZONES_FILE, zones);
    return true;
  }
  return false;
}

// 给新区域找一个不重叠的位置（螺旋式向外扩展）
async function findFreePosition(): Promise<{ x: number; y: number }> {
  const zones = await getAllZones();
  const occupied = new Set<string>();
  for (const z of zones) {
    for (let dx = 0; dx < z.gridW; dx++) {
      for (let dy = 0; dy < z.gridH; dy++) {
        occupied.add(`${z.gridX + dx},${z.gridY + dy}`);
      }
    }
  }

  // 螺旋搜索从中心 (10,8) 开始
  const cx = 10, cy = 8;
  for (let r = 0; r < 20; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx * 5;
        const y = cy + dy * 4;
        if (x < 0 || y < 0) continue;
        let fits = true;
        for (let bx = 0; bx < 4 && fits; bx++) {
          for (let by = 0; by < 3 && fits; by++) {
            if (occupied.has(`${x + bx},${y + by}`)) fits = false;
          }
        }
        if (fits) return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

function mapZoneRow(r: Record<string, unknown>): Zone {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string | null,
    color: r.color as string,
    icon: r.icon as string,
    gridX: r.grid_x as number,
    gridY: r.grid_y as number,
    gridW: r.grid_w as number,
    gridH: r.grid_h as number,
    creatorId: r.creator_id as string,
    status: r.status as Zone["status"],
    voteDeadline: r.vote_deadline as string | null,
    approveCount: (r.approve_count as number) ?? 0,
    rejectCount: (r.reject_count as number) ?? 0,
    createdAt: r.created_at as string,
  };
}
