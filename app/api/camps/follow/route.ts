import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { followCamp, unfollowCamp, getFollowedCamps } from "@/lib/camps";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  return NextResponse.json({ follows: await getFollowedCamps(userId) });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, campId, action } = await request.json();
  if (!userId || !campId) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  if (action === "unfollow") await unfollowCamp(userId, campId);
  else await followCamp(userId, campId);
  return NextResponse.json({ ok: true });
}
