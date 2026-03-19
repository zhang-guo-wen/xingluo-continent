import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { boostTarget } from "@/lib/economy";

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, targetType, targetId, computeAmount } = await request.json();
  if (!userId || !targetType || !targetId || !computeAmount) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const ok = await boostTarget(userId, targetType, targetId, computeAmount);
  if (!ok) return NextResponse.json({ error: "算力不足" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
