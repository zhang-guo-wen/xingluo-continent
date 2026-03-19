import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { createAppeal, getPendingAppeals } from "@/lib/appeals";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ appeals: await getPendingAppeals() });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, userName, targetPostId, action, reason } = await request.json();
  if (!userId || !targetPostId || !action || !reason?.trim()) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const appeal = await createAppeal({ userId, userName, targetPostId, action, reason: reason.trim() });
  return NextResponse.json({ appeal });
}
