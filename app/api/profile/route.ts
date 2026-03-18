import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { updateUserProfile } from "@/lib/db";

export async function PUT(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { userId, name, occupation, description, walletAddress } = await request.json();
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

  const user = await updateUserProfile(userId, { name, occupation, description, walletAddress });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  return NextResponse.json({ user });
}
