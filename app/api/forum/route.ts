import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getAllPosts, getCampPosts } from "@/lib/db";
import { getFollowedCamps, getFriends } from "@/lib/camps";
import { getPostsReactions } from "@/lib/kv";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

  // 并行获取关注数据
  const [followedCamps, friends, allPosts] = await Promise.all([
    getFollowedCamps(userId),
    getFriends(userId),
    getAllPosts(),
  ]);

  const friendIds = new Set(friends.map((f) => f.friendId));
  const campIds = new Set(followedCamps.map((f) => f.campId));

  // 聚合：关注营地的帖子 + 好友的帖子
  const forumPosts = allPosts.filter((p) => {
    if (friendIds.has(p.userId)) return true;          // 好友的帖子
    if (p.campId && campIds.has(p.campId)) return true; // 关注营地的帖子
    if (p.userId === userId) return true;               // 自己的帖子
    return false;
  });

  const postIds = forumPosts.map((p) => p.id);
  const reactions = await getPostsReactions(postIds, userId);

  return NextResponse.json({
    posts: forumPosts.map((p) => ({
      ...p,
      likes: reactions[p.id]?.likes ?? 0,
      dislikes: reactions[p.id]?.dislikes ?? 0,
      userReaction: reactions[p.id]?.userReaction ?? null,
    })),
  });
}
