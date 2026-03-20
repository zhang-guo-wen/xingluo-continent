import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getAllPosts } from "@/lib/db";
import { getFollowedCamps, getFriends } from "@/lib/camps";
import { getPostsReactions } from "@/lib/kv";
import { getCommentCounts } from "@/lib/comments";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = request.nextUrl.searchParams.get("userId");
  const filter = request.nextUrl.searchParams.get("filter");
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

  const [followedCamps, friends, allPosts] = await Promise.all([
    getFollowedCamps(userId),
    getFriends(userId),
    getAllPosts(),
  ]);

  const friendIds = new Set(friends.map((f) => f.friendId));
  const campIds = new Set(followedCamps.map((f) => f.campId));

  const forumPosts = allPosts.filter((p) => {
    if (p.userId === userId) return true;
    if (filter === "camps") return p.campId ? campIds.has(p.campId) : false;
    if (filter === "friends") return friendIds.has(p.userId);
    return friendIds.has(p.userId) || (p.campId && campIds.has(p.campId));
  });

  const postIds = forumPosts.map((p) => p.id);
  const [reactions, commentCounts] = await Promise.all([
    getPostsReactions(postIds, userId),
    getCommentCounts(postIds),
  ]);

  return NextResponse.json({
    posts: forumPosts.map((p) => ({
      ...p,
      likes: reactions[p.id]?.likes ?? 0,
      dislikes: reactions[p.id]?.dislikes ?? 0,
      commentCount: commentCounts[p.id] ?? 0,
      userReaction: reactions[p.id]?.userReaction ?? null,
    })),
  });
}
