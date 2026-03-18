import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getUserSkills, addSkill, removeSkill } from "@/lib/profile";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  return NextResponse.json({ skills: await getUserSkills(userId) });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, name, description } = await request.json();
  if (!userId || !name?.trim()) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const skill = await addSkill(userId, name.trim(), description?.trim());
  return NextResponse.json({ skill });
}

export async function DELETE(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { skillId, userId } = await request.json();
  await removeSkill(skillId, userId);
  return NextResponse.json({ ok: true });
}
