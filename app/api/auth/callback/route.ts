import { NextRequest, NextResponse } from "next/server";
import { setTokenCookie } from "@/lib/auth";
import { upsertPlazaUser } from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  try {
    // 用授权码换取 token
    const res = await fetch(
      `${process.env.SECONDME_API_BASE_URL}/api/oauth/token/code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.SECONDME_REDIRECT_URI!,
          client_id: process.env.SECONDME_CLIENT_ID!,
          client_secret: process.env.SECONDME_CLIENT_SECRET!,
        }),
      }
    );

    const result = await res.json();

    if (result.code !== 0 || !result.data) {
      console.error("Token exchange failed:", result);
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", request.url)
      );
    }

    const { accessToken, refreshToken, expiresIn } = result.data;

    // 存储 token 到 httpOnly cookie
    await setTokenCookie({ accessToken, refreshToken, expiresIn });

    // 拉取用户信息，注册到广场
    try {
      const userRes = await fetch(
        `${process.env.SECONDME_API_BASE_URL}/api/secondme/user/info`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userResult = await userRes.json();
      if (userResult.code === 0 && userResult.data) {
        const u = userResult.data;
        upsertPlazaUser({
          id: u.id ?? u.email ?? accessToken.slice(-12),
          name: u.name ?? u.nickname ?? "匿名用户",
          avatarUrl: u.avatarUrl ?? null,
          route: u.route ?? null,
          joinedAt: new Date().toISOString(),
        });
      }
    } catch {
      // 注册广场失败不影响登录
    }

    return NextResponse.redirect(new URL("/plaza", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=server_error", request.url)
    );
  }
}
