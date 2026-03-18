import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { createPost, getAllPosts } from "@/lib/db";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ posts: getAllPosts() });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, userName, userAvatar, content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
  }

  const post = createPost({
    userId,
    userName,
    userAvatar,
    content: content.trim(),
  });

  return NextResponse.json({ post });
}
