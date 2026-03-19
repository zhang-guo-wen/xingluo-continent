import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { checkin } from "@/lib/economy";

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  const result = await checkin(userId);
  return NextResponse.json(result);
}
