import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { updateUserProfile } from "@/lib/db";
import { recordEvent } from "@/lib/events";

export async function PUT(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { userId, userName, name, occupation, description, walletAddress } = await request.json();
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

  const uName = userName ?? name ?? "用户";

  const user = await updateUserProfile(userId, { name, occupation, description, walletAddress });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  // 记录事件
  if (name) recordEvent(userId, uName, "update_name", `修改名字为「${name}」`).catch(() => {});
  if (occupation !== undefined) recordEvent(userId, uName, "update_occupation", `修改职业为「${occupation || "无"}」`).catch(() => {});
  if (description !== undefined) recordEvent(userId, uName, "update_description", `修改个人描述`).catch(() => {});
  if (walletAddress !== undefined) recordEvent(userId, uName, "update_wallet", `更新钱包地址`).catch(() => {});

  return NextResponse.json({ user });
}
