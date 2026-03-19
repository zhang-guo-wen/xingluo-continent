import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import type { Transaction, TxType, CheckinResult, ComputeBoost, PlazaUser, LeaderboardType } from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      from_user_id TEXT,
      to_user_id TEXT,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      ref_id TEXT,
      memo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      checkin_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, checkin_date)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS compute_boosts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      compute_spent INTEGER NOT NULL,
      boost_score REAL NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS reputation_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS info_price_history (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // 迁移：给 plaza_users 加 compute 列
  await sql`ALTER TABLE plaza_users ADD COLUMN IF NOT EXISTS compute INTEGER NOT NULL DEFAULT 0`.catch(() => {});
  // 迁移：给 user_items 加价格追踪列
  await sql`ALTER TABLE user_items ADD COLUMN IF NOT EXISTS current_price REAL`.catch(() => {});
  await sql`ALTER TABLE user_items ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`.catch(() => {});
  await sql`ALTER TABLE user_items ADD COLUMN IF NOT EXISTS buy_count INTEGER DEFAULT 0`.catch(() => {});
  schemaReady = true;
}

// ============ 文件回退 ============
const DATA_DIR = path.join(process.cwd(), "data");
function readJson<T>(fp: string, fb: T): T {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(fp)) return fb;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return fb; }
}
function writeJson<T>(fp: string, d: T) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf-8");
}
const TX_FILE = path.join(DATA_DIR, "transactions.json");
const CHECKIN_FILE = path.join(DATA_DIR, "checkins.json");
const BOOSTS_FILE = path.join(DATA_DIR, "boosts.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// ============ 金币系统 ============

/** 系统铸造金币 */
export async function mintCoins(userId: string, amount: number, type: TxType, memo?: string): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE plaza_users SET coins = coins + ${amount} WHERE id = ${userId}`;
    await sql`INSERT INTO transactions (id, from_user_id, to_user_id, amount, type, memo)
      VALUES (${genId("tx")}, NULL, ${userId}, ${amount}, ${type}, ${memo ?? null})`;
    return;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const u = users.find((x) => x.id === userId);
  if (u) { u.coins += amount; writeJson(USERS_FILE, users); }
  const txs = readJson<Transaction[]>(TX_FILE, []);
  txs.push({ id: genId("tx"), fromUserId: null, toUserId: userId, amount, type, refId: null, memo: memo ?? null, createdAt: new Date().toISOString() });
  writeJson(TX_FILE, txs);
}

/** 用户间转账（买卖） */
export async function transferCoins(
  fromId: string, toId: string, amount: number, type: TxType, refId?: string
): Promise<boolean> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    // 检查余额
    const [row] = await sql`SELECT coins FROM plaza_users WHERE id = ${fromId}`;
    if (!row || (row.coins as number) < amount) return false;
    await sql`UPDATE plaza_users SET coins = coins - ${amount} WHERE id = ${fromId}`;
    await sql`UPDATE plaza_users SET coins = coins + ${amount} WHERE id = ${toId}`;
    await sql`INSERT INTO transactions (id, from_user_id, to_user_id, amount, type, ref_id)
      VALUES (${genId("tx")}, ${fromId}, ${toId}, ${amount}, ${type}, ${refId ?? null})`;
    return true;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const from = users.find((u) => u.id === fromId);
  const to = users.find((u) => u.id === toId);
  if (!from || !to || from.coins < amount) return false;
  from.coins -= amount;
  to.coins += amount;
  writeJson(USERS_FILE, users);
  const txs = readJson<Transaction[]>(TX_FILE, []);
  txs.push({ id: genId("tx"), fromUserId: fromId, toUserId: toId, amount, type, refId: refId ?? null, memo: null, createdAt: new Date().toISOString() });
  writeJson(TX_FILE, txs);
  return true;
}

/** 获取用户交易流水 */
export async function getTransactions(userId: string, limit = 50): Promise<Transaction[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT * FROM transactions WHERE from_user_id = ${userId} OR to_user_id = ${userId}
      ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id, fromUserId: r.from_user_id, toUserId: r.to_user_id,
      amount: r.amount, type: r.type as TxType, refId: r.ref_id, memo: r.memo, createdAt: r.created_at,
    }));
  }
  return readJson<Transaction[]>(TX_FILE, [])
    .filter((t) => t.fromUserId === userId || t.toUserId === userId)
    .slice(0, limit);
}

// ============ 信誉系统 ============

export async function addReputation(userId: string, delta: number, reason: string, refId?: string): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE plaza_users SET reputation = reputation + ${delta} WHERE id = ${userId}`;
    await sql`INSERT INTO reputation_events (id, user_id, delta, reason, ref_id)
      VALUES (${genId("rep")}, ${userId}, ${delta}, ${reason}, ${refId ?? null})`;
    return;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const u = users.find((x) => x.id === userId);
  if (u) { u.reputation += delta; writeJson(USERS_FILE, users); }
}

// ============ 算力系统 ============

export async function addCompute(userId: string, amount: number): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE plaza_users SET compute = compute + ${amount} WHERE id = ${userId}`;
    return;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const u = users.find((x) => x.id === userId);
  if (u) { u.compute = (u.compute ?? 0) + amount; writeJson(USERS_FILE, users); }
}

export async function boostTarget(
  userId: string, targetType: "post" | "item", targetId: string, computeAmount: number
): Promise<boolean> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const [row] = await sql`SELECT compute FROM plaza_users WHERE id = ${userId}`;
    if (!row || (row.compute as number) < computeAmount) return false;
    await sql`UPDATE plaza_users SET compute = compute - ${computeAmount} WHERE id = ${userId}`;
    await sql`INSERT INTO compute_boosts (id, user_id, target_type, target_id, compute_spent, boost_score)
      VALUES (${genId("boost")}, ${userId}, ${targetType}, ${targetId}, ${computeAmount}, ${Math.log(1 + computeAmount)})`;
    return true;
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const u = users.find((x) => x.id === userId);
  if (!u || (u.compute ?? 0) < computeAmount) return false;
  u.compute -= computeAmount;
  writeJson(USERS_FILE, users);
  const boosts = readJson<ComputeBoost[]>(BOOSTS_FILE, []);
  boosts.push({ id: genId("boost"), userId, targetType, targetId, computeSpent: computeAmount, boostScore: Math.log(1 + computeAmount), createdAt: new Date().toISOString() });
  writeJson(BOOSTS_FILE, boosts);
  return true;
}

export async function getBoostScore(targetId: string): Promise<number> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const [row] = await sql`SELECT COALESCE(SUM(boost_score), 0)::real AS score FROM compute_boosts WHERE target_id = ${targetId}`;
    return row?.score ?? 0;
  }
  const boosts = readJson<ComputeBoost[]>(BOOSTS_FILE, []);
  return boosts.filter((b) => b.targetId === targetId).reduce((s, b) => s + b.boostScore, 0);
}

// ============ 签到 ============

export async function checkin(userId: string): Promise<CheckinResult> {
  const coinReward = 5;
  const computeReward = 10;
  const today = new Date().toISOString().slice(0, 10);

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const existing = await sql`SELECT id FROM daily_checkins WHERE user_id = ${userId} AND checkin_date = ${today}`;
    if (existing.length > 0) return { alreadyDone: true, coinReward: 0, computeReward: 0 };
    await sql`INSERT INTO daily_checkins (id, user_id, checkin_date) VALUES (${genId("ck")}, ${userId}, ${today})`;
  } else {
    const cks = readJson<{ userId: string; date: string }[]>(CHECKIN_FILE, []);
    if (cks.some((c) => c.userId === userId && c.date === today)) {
      return { alreadyDone: true, coinReward: 0, computeReward: 0 };
    }
    cks.push({ userId, date: today });
    writeJson(CHECKIN_FILE, cks);
  }

  await mintCoins(userId, coinReward, "checkin", "每日签到");
  await addCompute(userId, computeReward);
  await addReputation(userId, 1, "checkin");
  return { alreadyDone: false, coinReward, computeReward };
}

// ============ 排行榜 ============

export async function getLeaderboard(type: LeaderboardType, limit = 50): Promise<PlazaUser[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    let rows;
    if (type === "reputation") rows = await sql`SELECT * FROM plaza_users ORDER BY reputation DESC LIMIT ${limit}`;
    else if (type === "coins") rows = await sql`SELECT * FROM plaza_users ORDER BY coins DESC LIMIT ${limit}`;
    else rows = await sql`SELECT * FROM plaza_users ORDER BY compute DESC LIMIT ${limit}`;

    return rows.map((r) => ({
      id: r.id, userNo: r.user_no, name: r.name,
      occupation: r.occupation, description: r.description,
      avatarUrl: r.avatar_url, route: r.route,
      walletAddress: r.wallet_address, cityId: r.city_id ?? "xingluo",
      reputation: r.reputation, coins: r.coins, compute: r.compute ?? 0,
      joinedAt: r.joined_at,
    }));
  }
  const users = readJson<PlazaUser[]>(USERS_FILE, []);
  const getValue = (u: PlazaUser) => type === "reputation" ? u.reputation : type === "coins" ? u.coins : (u.compute ?? 0);
  const sorted = [...users].sort((a, b) => getValue(b) - getValue(a));
  return sorted.slice(0, limit);
}

// ============ 信息定价 ============

export function calcInfoPrice(basePrice: number, buyCount: number): number {
  return Math.round(basePrice * (1 + 0.05 * Math.log(1 + buyCount)));
}

export async function recordPriceHistory(itemId: string, price: number): Promise<void> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`INSERT INTO info_price_history (id, item_id, price) VALUES (${genId("ph")}, ${itemId}, ${price})`;
    return;
  }
  // 本地不追踪价格历史
}
