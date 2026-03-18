import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";

const API_BASE = process.env.SECONDME_API_BASE_URL!;

/** 获取用户基本信息 */
export async function GET() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 并行请求用户信息和兴趣标签
    const [infoRes, shadesRes, memoryRes] = await Promise.all([
      fetch(`${API_BASE}/api/secondme/user/info`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`${API_BASE}/api/secondme/user/shades`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`${API_BASE}/api/secondme/user/softmemory`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const [infoResult, shadesResult, memoryResult] = await Promise.all([
      infoRes.json(),
      shadesRes.json(),
      memoryRes.json(),
    ]);

    return NextResponse.json({
      user: infoResult.code === 0 ? infoResult.data : null,
      shades: shadesResult.code === 0 ? shadesResult.data?.shades ?? [] : [],
      memories:
        memoryResult.code === 0 ? memoryResult.data?.list ?? [] : [],
    });
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    return NextResponse.json(
      { error: "failed_to_fetch" },
      { status: 502 }
    );
  }
}
