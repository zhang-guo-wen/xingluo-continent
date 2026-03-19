import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { joinCamp } from "@/lib/camps";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { campId } = await params;
  const { userId, userName } = await request.json();
  if (!userId) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const result = await joinCamp(campId, userId, userName ?? "用户");
  return NextResponse.json(result);
}
