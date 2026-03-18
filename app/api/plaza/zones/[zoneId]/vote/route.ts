import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { voteForZone } from "@/lib/zones";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { zoneId } = await params;
  const body = await request.json();
  const { userId, vote } = body;

  if (!userId || !["approve", "reject"].includes(vote)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const result = await voteForZone(zoneId, userId, vote);
  return NextResponse.json(result);
}
