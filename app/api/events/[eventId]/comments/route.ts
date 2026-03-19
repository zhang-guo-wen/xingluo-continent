import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getEventComments, addEventComment } from "@/lib/events";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { eventId } = await params;
  return NextResponse.json({ comments: await getEventComments(eventId) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { eventId } = await params;
  const { userId, userName, content } = await request.json();
  if (!userId || !content?.trim()) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const comment = await addEventComment(eventId, userId, userName, content.trim());
  return NextResponse.json({ comment });
}
