import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import type { City, CityVote } from "./types";

export type { City, CityVote };

// ============ 默认城市 ============

const DEFAULT_CITY: City = {
  id: "xingluo",
  name: "星罗城",
  description: "所有冒险者的起点，星罗大陆的中心城市",
  color: "#4a9c5d",
  icon: "castle",
  galaxyX: 0, galaxyY: 0, galaxyZ: 0,
  gridX: 7, gridY: 5, gridW: 6, gridH: 5,
  capacity: 1_000_000,
  population: 0,
  creatorId: "system",
  status: "active",
  voteCount: 0,
  voteThreshold: 10_000,
  createdAt: new Date().toISOString(),
};

// ============ Postgres ============

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#4a9c5d',
      icon TEXT NOT NULL DEFAULT 'castle',
      galaxy_x REAL NOT NULL DEFAULT 0,
      galaxy_y REAL NOT NULL DEFAULT 0,
      galaxy_z REAL NOT NULL DEFAULT 0,
      grid_x INTEGER NOT NULL DEFAULT 0,
      grid_y INTEGER NOT NULL DEFAULT 0,
      grid_w INTEGER NOT NULL DEFAULT 4,
      grid_h INTEGER NOT NULL DEFAULT 3,
      capacity INTEGER NOT NULL DEFAULT 1000000,
      population INTEGER NOT NULL DEFAULT 0,
      creator_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'voting',
      vote_count INTEGER NOT NULL DEFAULT 0,
      vote_threshold INTEGER NOT NULL DEFAULT 10000,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS city_votes (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (city_id, user_id)
    )
  `;
  await sql`
    INSERT INTO cities (id, name, description, color, icon, galaxy_x, galaxy_y, galaxy_z, grid_x, grid_y, grid_w, grid_h, capacity, creator_id, status, vote_threshold)
    VALUES ('xingluo', '星罗城', '所有冒险者的起点，星罗大陆的中心城市', '#4a9c5d', 'castle', 0, 0, 0, 7, 5, 6, 5, 1000000, 'system', 'active', 10000)
    ON CONFLICT (id) DO NOTHING
  `;
  schemaReady = true;
}

// ============ 文件回退 ============

const DATA_DIR = path.join(process.cwd(), "data");
const CITIES_FILE = path.join(DATA_DIR, "cities.json");
const VOTES_FILE = path.join(DATA_DIR, "city_votes.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJson<T>(fp: string, fb: T): T {
  ensureDir();
  if (!fs.existsSync(fp)) return fb;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { return fb; }
}
function writeJson<T>(fp: string, d: T) {
  ensureDir();
  fs.writeFileSync(fp, JSON.stringify(d, null, 2), "utf-8");
}

// ============ 导出 ============

export async function getAllCities(): Promise<City[]> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT c.*, COALESCE((SELECT COUNT(*)::int FROM city_votes v WHERE v.city_id = c.id), 0) AS vote_count,
        COALESCE((SELECT COUNT(*)::int FROM plaza_users u WHERE u.city_id = c.id), 0) AS population
      FROM cities c ORDER BY c.created_at ASC
    `;
    return rows.map(mapRow);
  }
  const cities = readJson<City[]>(CITIES_FILE, [DEFAULT_CITY]);
  if (cities.length === 0) { cities.push(DEFAULT_CITY); writeJson(CITIES_FILE, cities); }
  return cities;
}

export async function getCity(id: string): Promise<City | null> {
  const all = await getAllCities();
  return all.find((c) => c.id === id) ?? null;
}

export async function proposeCity(input: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  creatorId: string;
}): Promise<City> {
  const id = genId("city");
  const gx = (Math.random() - 0.5) * 200;
  const gy = (Math.random() - 0.5) * 200;
  const gz = (Math.random() - 0.5) * 50;
  const pos = await findFreePosition();

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`
      INSERT INTO cities (id, name, description, color, icon, galaxy_x, galaxy_y, galaxy_z, grid_x, grid_y, grid_w, grid_h, creator_id, status, vote_threshold)
      VALUES (${id}, ${input.name}, ${input.description ?? null}, ${input.color ?? "#6b8cff"}, ${input.icon ?? "house"},
              ${gx}, ${gy}, ${gz}, ${pos.x}, ${pos.y}, 4, 3, ${input.creatorId}, 'voting', 10000)
    `;
  } else {
    const cities = readJson<City[]>(CITIES_FILE, [DEFAULT_CITY]);
    cities.push({
      id, name: input.name, description: input.description ?? null,
      color: input.color ?? "#6b8cff", icon: input.icon ?? "house",
      galaxyX: gx, galaxyY: gy, galaxyZ: gz,
      gridX: pos.x, gridY: pos.y, gridW: 4, gridH: 3,
      capacity: 1_000_000, population: 0, creatorId: input.creatorId,
      status: "voting", voteCount: 0, voteThreshold: 10_000,
      createdAt: new Date().toISOString(),
    });
    writeJson(CITIES_FILE, cities);
  }
  return (await getCity(id))!;
}

export async function voteCity(cityId: string, userId: string): Promise<{ city: City; activated: boolean }> {
  const vid = genId("cvote");

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`
      INSERT INTO city_votes (id, city_id, user_id) VALUES (${vid}, ${cityId}, ${userId})
      ON CONFLICT (city_id, user_id) DO NOTHING
    `;
  } else {
    const votes = readJson<CityVote[]>(VOTES_FILE, []);
    if (!votes.some((v) => v.cityId === cityId && v.userId === userId)) {
      votes.push({ id: vid, cityId, userId, createdAt: new Date().toISOString() });
      writeJson(VOTES_FILE, votes);
    }
  }

  const activated = await checkActivation(cityId);
  const city = (await getCity(cityId))!;
  return { city, activated };
}

async function checkActivation(cityId: string): Promise<boolean> {
  if (DATABASE_URL) {
    const sql = neon(DATABASE_URL);
    const [row] = await sql`SELECT status, vote_threshold FROM cities WHERE id = ${cityId}`;
    if (!row || row.status !== "voting") return false;
    const [{ cnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM city_votes WHERE city_id = ${cityId}`;
    if (cnt >= row.vote_threshold) {
      await sql`UPDATE cities SET status = 'active' WHERE id = ${cityId}`;
      return true;
    }
    return false;
  }
  const cities = readJson<City[]>(CITIES_FILE, []);
  const city = cities.find((c) => c.id === cityId);
  if (!city || city.status !== "voting") return false;
  const votes = readJson<CityVote[]>(VOTES_FILE, []);
  const cnt = votes.filter((v) => v.cityId === cityId).length;
  if (cnt >= city.voteThreshold) {
    city.status = "active";
    writeJson(CITIES_FILE, cities);
    return true;
  }
  return false;
}

async function findFreePosition(): Promise<{ x: number; y: number }> {
  const cities = await getAllCities();
  const occupied = new Set<string>();
  for (const c of cities) {
    for (let dx = 0; dx < c.gridW; dx++)
      for (let dy = 0; dy < c.gridH; dy++)
        occupied.add(`${c.gridX + dx},${c.gridY + dy}`);
  }
  for (let r = 0; r < 20; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = 10 + dx * 5, y = 8 + dy * 4;
        if (x < 0 || y < 0) continue;
        let fits = true;
        for (let bx = 0; bx < 4 && fits; bx++)
          for (let by = 0; by < 3 && fits; by++)
            if (occupied.has(`${x + bx},${y + by}`)) fits = false;
        if (fits) return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

function mapRow(r: Record<string, unknown>): City {
  return {
    id: r.id as string, name: r.name as string,
    description: r.description as string | null,
    color: r.color as string, icon: r.icon as string,
    galaxyX: r.galaxy_x as number, galaxyY: r.galaxy_y as number, galaxyZ: r.galaxy_z as number,
    gridX: r.grid_x as number, gridY: r.grid_y as number,
    gridW: r.grid_w as number, gridH: r.grid_h as number,
    capacity: r.capacity as number, population: (r.population as number) ?? 0,
    creatorId: r.creator_id as string,
    status: r.status as City["status"],
    voteCount: (r.vote_count as number) ?? 0,
    voteThreshold: r.vote_threshold as number,
    createdAt: r.created_at as string,
  };
}
