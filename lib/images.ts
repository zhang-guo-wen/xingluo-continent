import { neon } from "@neondatabase/serverless";
import { genId } from "./utils";

const DATABASE_URL = process.env.DATABASE_URL;
let schemaReady = false;

async function ensureSchema() {
  if (!DATABASE_URL || schemaReady) return;
  const sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS uploaded_images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

/** 上传图片到 PG，返回图片 ID */
export async function uploadImage(
  userId: string, buffer: Buffer, mimeType: string
): Promise<string> {
  const id = genId("img");
  if (DATABASE_URL) {
    await ensureSchema();
    const sql = neon(DATABASE_URL);
    // 用 hex 编码存入 bytea
    const hex = "\\x" + buffer.toString("hex");
    await sql`INSERT INTO uploaded_images (id, user_id, mime_type, size, data)
      VALUES (${id}, ${userId}, ${mimeType}, ${buffer.length}, ${hex}::bytea)`;
  }
  return id;
}

/** 读取图片二进制 */
export async function getImage(id: string): Promise<{ data: Buffer; mimeType: string } | null> {
  if (!DATABASE_URL) return null;
  await ensureSchema();
  const sql = neon(DATABASE_URL);
  const rows = await sql`SELECT data, mime_type FROM uploaded_images WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const row = rows[0];
  // neon 返回 bytea 为 hex string "\\x..."
  const hex = (row.data as string).replace(/^\\x/, "");
  return { data: Buffer.from(hex, "hex"), mimeType: row.mime_type as string };
}
