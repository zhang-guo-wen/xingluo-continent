import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { addFriend, removeFriend, getFriends } from "@/lib/camps";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  return NextResponse.json({ friends: await getFriends(userId) });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, friendId, action } = await request.json();
  if (!userId || !friendId) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  if (action === "remove") await removeFriend(userId, friendId);
  else await addFriend(userId, friendId);
  return NextResponse.json({ ok: true });
}
