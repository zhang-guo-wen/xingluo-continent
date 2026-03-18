import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { toggleReaction, ReactionType } from "@/lib/kv";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { postId } = await params;
  const body = await request.json();
  const { userId, action } = body as { userId: string; action: ReactionType };

  if (!userId || !["like", "dislike"].includes(action)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const result = await toggleReaction(postId, userId, action);
  return NextResponse.json(result);
}
