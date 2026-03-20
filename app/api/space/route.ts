import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { visitSpace, getSpaceVisitors } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  if (!ownerId) return NextResponse.json({ error: "缺少 ownerId" }, { status: 400 });
  return NextResponse.json({ visitors: await getSpaceVisitors(ownerId) });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ownerId, visitorId } = await request.json();
  if (!ownerId || !visitorId) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  await visitSpace(ownerId, visitorId);
  return NextResponse.json({ ok: true });
}
