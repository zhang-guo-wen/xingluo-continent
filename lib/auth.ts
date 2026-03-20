import { cookies } from "next/headers";
import type { SecondMeUserInfo, TokenData } from "./types";

export type { SecondMeUserInfo, TokenData };

const API_BASE_URL = process.env.SECONDME_API_BASE_URL!;

/** 从 Request 的 Authorization header 提取 Bearer token */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/** 用 accessToken 调用 SecondMe 上游接口，解析出用户信息 */
export async function resolveSecondMeUser(
  accessToken: string
): Promise<SecondMeUserInfo | null> {
  // 先尝试 OAuth token (lba_at_)
  try {
    const res = await fetch(`${API_BASE_URL}/api/secondme/user/info`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = await res.json();
    if (result.code === 0 && result.data) {
      const d = result.data;
      return {
        id: d.id ?? d.email ?? accessToken.slice(-12),
        name: d.name ?? d.nickname ?? "匿名用户",
        nickname: d.nickname,
        email: d.email,
        avatarUrl: d.avatarUrl ?? null,
        route: d.route ?? null,
      };
    }
  } catch {}

  // 回退：尝试 sm- token (third-party-agent)
  try {
    const res = await fetch("https://app.mindos.com/gate/in/rest/third-party-agent/v1/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = await res.json();
    if (result.code === 0 && result.data) {
      const d = result.data;
      // 尝试通过 route 匹配已有 OAuth 用户，保持 ID 一致
      const { neon } = await import("@neondatabase/serverless");
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl && d.originRoute) {
        const sql = neon(dbUrl);
        const rows = await sql`SELECT id, name FROM plaza_users WHERE route = ${d.originRoute} LIMIT 1`;
        if (rows.length > 0) {
          return {
            id: rows[0].id as string,
            name: d.name ?? rows[0].name as string,
            nickname: d.name,
            avatarUrl: d.avatar ?? null,
            route: d.originRoute ?? null,
          };
        }
      }
      return {
        id: d.originRoute ?? d.name ?? accessToken.slice(-12),
        name: d.name ?? "匿名用户",
        nickname: d.name,
        avatarUrl: d.avatar ?? null,
        route: d.originRoute ?? null,
      };
    }
  } catch {}

  return null;
}

/** MCP 请求鉴权：提取 token → 解析用户，失败返回 null */
export async function requireMcpAuth(
  request: Request
): Promise<{ accessToken: string; user: SecondMeUserInfo } | null> {
  const accessToken = readBearerToken(request);
  if (!accessToken) return null;
  const user = await resolveSecondMeUser(accessToken);
  if (!user) return null;
  return { accessToken, user };
}

// ============ 浏览器用户 Cookie 鉴权 ============

/** 从 cookie 读取 token */
export async function getTokenFromCookie(): Promise<TokenData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("secondme_token")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

/** 将 token 写入 httpOnly cookie */
export async function setTokenCookie(data: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const cookieStore = await cookies();
  const tokenData: TokenData = {
    ...data,
    expiresAt: Date.now() + data.expiresIn * 1000,
  };
  cookieStore.set("secondme_token", JSON.stringify(tokenData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 天（配合 refreshToken 有效期）
  });
}

/** 清除 token cookie */
export async function clearTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("secondme_token");
}

/** 获取有效的 accessToken，过期时自动刷新 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokenData = await getTokenFromCookie();
  if (!tokenData) return null;

  // 如果还没过期（预留 60s 缓冲），直接返回
  if (Date.now() < tokenData.expiresAt - 60_000) {
    return tokenData.accessToken;
  }

  // 尝试刷新
  try {
    const res = await fetch(`${API_BASE_URL}/api/oauth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenData.refreshToken,
        client_id: process.env.SECONDME_CLIENT_ID!,
        client_secret: process.env.SECONDME_CLIENT_SECRET!,
      }),
    });
    const result = await res.json();
    if (result.code === 0 && result.data) {
      await setTokenCookie({
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        expiresIn: result.data.expiresIn,
      });
      return result.data.accessToken;
    }
  } catch {
    // 刷新失败，返回 null
  }
  return null;
}
