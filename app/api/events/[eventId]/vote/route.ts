import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { voteEvent } from "@/lib/events";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { eventId } = await params;
  const { userId, vote } = await request.json();
  if (!userId || !["like", "dislike"].includes(vote)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const result = await voteEvent(eventId, userId, vote);
  return NextResponse.json(result);
}
