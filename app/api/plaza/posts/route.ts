import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { createPost, getAllPosts, getCampPosts } from "@/lib/db";
import { getPostsReactions } from "@/lib/kv";
import { getCommentCounts } from "@/lib/comments";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = request.nextUrl.searchParams.get("userId") ?? undefined;
  const campId = request.nextUrl.searchParams.get("campId") ?? undefined;

  const posts = campId ? await getCampPosts(campId) : await getAllPosts();
  const postIds = posts.map((p) => p.id);
  const [reactions, commentCounts] = await Promise.all([
    getPostsReactions(postIds, userId),
    getCommentCounts(postIds),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      likes: reactions[p.id]?.likes ?? 0,
      dislikes: reactions[p.id]?.dislikes ?? 0,
      commentCount: commentCounts[p.id] ?? 0,
      userReaction: reactions[p.id]?.userReaction ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userId, userName, userAvatar, campId, tags, tag, price, content } = body;
  if (!content?.trim()) return NextResponse.json({ error: "内容不能为空" }, { status: 400 });

  const post = await createPost({
    userId, userName, userAvatar,
    campId: campId ?? null, source: "web" as const, tags: tags ?? (tag ? [tag] : []), price: Number(price) || 0,
    content: content.trim(),
  });
  return NextResponse.json({ post });
}
