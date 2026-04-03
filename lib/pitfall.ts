import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { genId } from "./utils";
import { sanitizeFields } from "./sanitize";

// ============ 类型 ============

export interface PitfallReport {
  id: string;
  title: string;
  errorType: string;
  errorMessage: string | null;
  solution: string;
  rootCause: string | null;
  modelUsed: string | null;
  tokensSpent: number | null;
  timeSpentMinutes: number | null;
  difficulty: string;
  tags: string[];
  language: string | null;
  framework: string | null;
  authorId: string | null;
  authorName: string | null;
  helpfulCount: number;
  viewCount: number;
  contentHash: string;
  createdAt: string;
}

export interface CreatePitfallInput {
  title: string;
  errorType: string;
  errorMessage?: string;
  solution: string;
  rootCause?: string;
  modelUsed?: string;
  tokensSpent?: number;
  timeSpentMinutes?: number;
  difficulty?: string;
  tags?: string[];
  language?: string;
  framework?: string;
  authorId?: string;
  authorName?: string;
}

// ============ 数据层 ============

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS pitfall_reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT,
      solution TEXT NOT NULL,
      root_cause TEXT,
      model_used TEXT,
      tokens_spent INTEGER,
      time_spent_minutes INTEGER,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      tags TEXT NOT NULL DEFAULT '[]',
      language TEXT,
      framework TEXT,
      author_id TEXT,
      author_name TEXT,
      helpful_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS pitfall_feedback (
      report_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      vote TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (report_id, voter_id)
    )
  `.catch(() => {});
  schemaReady = true;
}

// ============ 文件回退 ============

const DATA_DIR = path.join(process.cwd(), "data");
const PITFALL_FILE = path.join(DATA_DIR, "pitfalls.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJson<T>(fp: string, fb: T): T {
  ensureDir();
  if (!fs.existsSync(fp)) return fb;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}
function writeJson(fp: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

// ============ 工具函数 ============

function computeHash(title: string, solution: string, errorType: string): string {
  return crypto.createHash("sha256").update(`${title}|${solution}|${errorType}`).digest("hex");
}

function rowToReport(r: Record<string, unknown>): PitfallReport {
  return {
    id: r.id as string,
    title: r.title as string,
    errorType: (r.error_type ?? r.errorType) as string,
    errorMessage: (r.error_message ?? r.errorMessage ?? null) as string | null,
    solution: r.solution as string,
    rootCause: (r.root_cause ?? r.rootCause ?? null) as string | null,
    modelUsed: (r.model_used ?? r.modelUsed ?? null) as string | null,
    tokensSpent: (r.tokens_spent ?? r.tokensSpent ?? null) as number | null,
    timeSpentMinutes: (r.time_spent_minutes ?? r.timeSpentMinutes ?? null) as number | null,
    difficulty: (r.difficulty ?? "medium") as string,
    tags: typeof r.tags === "string" ? JSON.parse(r.tags as string) : (r.tags ?? []) as string[],
    language: (r.language ?? null) as string | null,
    framework: (r.framework ?? null) as string | null,
    authorId: (r.author_id ?? r.authorId ?? null) as string | null,
    authorName: (r.author_name ?? r.authorName ?? null) as string | null,
    helpfulCount: (r.helpful_count ?? r.helpfulCount ?? 0) as number,
    viewCount: (r.view_count ?? r.viewCount ?? 0) as number,
    contentHash: (r.content_hash ?? r.contentHash ?? "") as string,
    createdAt: (r.created_at ?? r.createdAt ?? new Date().toISOString()) as string,
  };
}

// ============ CRUD ============

/** 创建踩坑经验（自动过滤敏感信息） */
export async function createPitfall(input: CreatePitfallInput): Promise<PitfallReport> {
  const { cleaned, totalRedacted } = sanitizeFields(input as unknown as Record<string, unknown>);
  const data = cleaned as unknown as CreatePitfallInput;
  const id = genId("pit");
  const contentHash = computeHash(data.title, data.solution, data.errorType);
  const tags = JSON.stringify(data.tags ?? []);
  const difficulty = data.difficulty ?? "medium";

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      INSERT INTO pitfall_reports (id, title, error_type, error_message, solution, root_cause,
        model_used, tokens_spent, time_spent_minutes, difficulty, tags, language, framework,
        author_id, author_name, content_hash)
      VALUES (${id}, ${data.title}, ${data.errorType}, ${data.errorMessage ?? null},
        ${data.solution}, ${data.rootCause ?? null}, ${data.modelUsed ?? null},
        ${data.tokensSpent ?? null}, ${data.timeSpentMinutes ?? null}, ${difficulty},
        ${tags}, ${data.language ?? null}, ${data.framework ?? null},
        ${data.authorId ?? null}, ${data.authorName ?? null}, ${contentHash})
      RETURNING *
    `;
    const report = rowToReport(rows[0]);
    if (totalRedacted > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (report as any)._redactedCount = totalRedacted;
    }
    return report;
  }

  // 文件回退
  const reports = readJson<Record<string, unknown>[]>(PITFALL_FILE, []);
  const record = {
    id, title: data.title, errorType: data.errorType, errorMessage: data.errorMessage ?? null,
    solution: data.solution, rootCause: data.rootCause ?? null, modelUsed: data.modelUsed ?? null,
    tokensSpent: data.tokensSpent ?? null, timeSpentMinutes: data.timeSpentMinutes ?? null,
    difficulty, tags: data.tags ?? [], language: data.language ?? null, framework: data.framework ?? null,
    authorId: data.authorId ?? null, authorName: data.authorName ?? null,
    helpfulCount: 0, viewCount: 0, contentHash, createdAt: new Date().toISOString(),
  };
  reports.unshift(record);
  writeJson(PITFALL_FILE, reports);
  return record as unknown as PitfallReport;
}

/** 获取单条踩坑经验（自增浏览量） */
export async function getPitfall(id: string): Promise<PitfallReport | null> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    await sql`UPDATE pitfall_reports SET view_count = view_count + 1 WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM pitfall_reports WHERE id = ${id}`;
    return rows.length ? rowToReport(rows[0]) : null;
  }

  const reports = readJson<Record<string, unknown>[]>(PITFALL_FILE, []);
  const r = reports.find((x) => x.id === id);
  if (r) (r as Record<string, unknown>).viewCount = ((r.viewCount as number) || 0) + 1;
  writeJson(PITFALL_FILE, reports);
  return r ? rowToReport(r) : null;
}

/** 列表（分页） */
export async function listPitfalls(offset = 0, limit = 20): Promise<{ reports: PitfallReport[]; total: number }> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const countRows = await sql`SELECT COUNT(*)::int AS cnt FROM pitfall_reports`;
    const total = countRows[0].cnt as number;
    const rows = await sql`SELECT * FROM pitfall_reports ORDER BY created_at DESC OFFSET ${offset} LIMIT ${limit}`;
    return { reports: rows.map(rowToReport), total };
  }

  const reports = readJson<Record<string, unknown>[]>(PITFALL_FILE, []);
  return {
    reports: reports.slice(offset, offset + limit).map(rowToReport),
    total: reports.length,
  };
}

/** 全文搜索（ILIKE 关键词匹配） */
export async function searchPitfalls(query: string, limit = 10): Promise<PitfallReport[]> {
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  // 用第一个词做数据库查询，其余词在应用层过滤
  const primary = `%${words[0]}%`;

  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const allText = `COALESCE(title,'') || ' ' || COALESCE(error_type,'') || ' ' || COALESCE(error_message,'') || ' ' || COALESCE(solution,'') || ' ' || COALESCE(tags,'') || ' ' || COALESCE(language,'') || ' ' || COALESCE(framework,'')`;
    const rows = await sql`
      SELECT *, (
        CASE WHEN title ILIKE ${primary} THEN 3 ELSE 0 END +
        CASE WHEN error_type ILIKE ${primary} THEN 2 ELSE 0 END +
        CASE WHEN solution ILIKE ${primary} THEN 2 ELSE 0 END +
        CASE WHEN tags ILIKE ${primary} THEN 1 ELSE 0 END
      ) AS relevance
      FROM pitfall_reports
      WHERE (${allText}) ILIKE ${primary}
      ORDER BY relevance DESC, helpful_count DESC, created_at DESC
      LIMIT ${limit * 3}
    `;
    // 应用层过滤剩余关键词
    const remaining = words.slice(1).map((w) => w.toLowerCase());
    const filtered = rows.filter((r) => {
      if (remaining.length === 0) return true;
      const text = [r.title, r.error_type, r.error_message, r.solution, r.tags, r.language, r.framework]
        .filter(Boolean).join(" ").toLowerCase();
      return remaining.every((w) => text.includes(w));
    });
    return filtered.slice(0, limit).map(rowToReport);
  }

  // 文件回退：拆词匹配（所有词都必须出现）
  const reports = readJson<Record<string, unknown>[]>(PITFALL_FILE, []);
  const lowerWords = words.map((w) => w.toLowerCase());
  const matched = reports.filter((r) => {
    const text = [r.title, r.errorType, r.errorMessage, r.solution, JSON.stringify(r.tags), r.language, r.framework]
      .filter(Boolean).join(" ").toLowerCase();
    return lowerWords.every((w) => text.includes(w));
  });
  return matched.slice(0, limit).map(rowToReport);
}

/** 统计信息 */
export async function getPitfallStats(): Promise<{
  total: number;
  todayCount: number;
  topErrorTypes: { type: string; count: number }[];
  topLanguages: { language: string; count: number }[];
  totalTokens: number;
  avgTimeMinutes: number;
}> {
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    const [totalR, todayR, errorR, langR, tokensR, timeR] = await Promise.all([
      sql`SELECT COUNT(*)::int AS cnt FROM pitfall_reports`,
      sql`SELECT COUNT(*)::int AS cnt FROM pitfall_reports WHERE created_at > NOW() - INTERVAL '1 day'`,
      sql`SELECT error_type AS type, COUNT(*)::int AS count FROM pitfall_reports GROUP BY error_type ORDER BY count DESC LIMIT 10`,
      sql`SELECT language, COUNT(*)::int AS count FROM pitfall_reports WHERE language IS NOT NULL GROUP BY language ORDER BY count DESC LIMIT 10`,
      sql`SELECT COALESCE(SUM(tokens_spent), 0)::int AS total FROM pitfall_reports`,
      sql`SELECT COALESCE(AVG(time_spent_minutes), 0)::float AS avg FROM pitfall_reports WHERE time_spent_minutes IS NOT NULL`,
    ]);
    return {
      total: totalR[0].cnt as number,
      todayCount: todayR[0].cnt as number,
      topErrorTypes: errorR as { type: string; count: number }[],
      topLanguages: langR as { language: string; count: number }[],
      totalTokens: tokensR[0].total as number,
      avgTimeMinutes: Math.round(timeR[0].avg as number),
    };
  }

  // 文件回退
  const reports = readJson<Record<string, unknown>[]>(PITFALL_FILE, []);
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = reports.filter((r) => (r.createdAt as string)?.startsWith(today)).length;
  const errorMap: Record<string, number> = {};
  const langMap: Record<string, number> = {};
  let totalTokens = 0;
  let timeSum = 0;
  let timeCount = 0;
  for (const r of reports) {
    errorMap[r.errorType as string] = (errorMap[r.errorType as string] || 0) + 1;
    if (r.language) langMap[r.language as string] = (langMap[r.language as string] || 0) + 1;
    if (r.tokensSpent) totalTokens += r.tokensSpent as number;
    if (r.timeSpentMinutes) { timeSum += r.timeSpentMinutes as number; timeCount++; }
  }
  return {
    total: reports.length,
    todayCount,
    topErrorTypes: Object.entries(errorMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([type, count]) => ({ type, count })),
    topLanguages: Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([language, count]) => ({ language, count })),
    totalTokens,
    avgTimeMinutes: timeCount ? Math.round(timeSum / timeCount) : 0,
  };
}
