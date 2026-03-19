import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { toggleReaction } from "@/lib/kv";
import { getAllPosts } from "@/lib/db";
import { addReputation, mintCoins } from "@/lib/economy";
import { recordEvent } from "@/lib/events";
import type { ReactionType } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { postId } = await params;
  const body = await request.json();
  const { userId, userName, action } = body as { userId: string; userName?: string; action: ReactionType };

  if (!userId || !["like", "dislike"].includes(action)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const result = await toggleReaction(postId, userId, action);

  // 找到帖子作者，触发信誉和金币变更
  const posts = await getAllPosts();
  const post = posts.find((p) => p.id === postId);
  if (post && post.userId !== userId) {
    if (action === "like" && result.userReaction === "like") {
      // 点赞：作者 +1 信誉, +1 XLC
      addReputation(post.userId, 1, "post_liked", postId).catch(() => {});
      mintCoins(post.userId, 1, "like_reward", "帖子被点赞").catch(() => {});
    } else if (action === "dislike" && result.userReaction === "dislike") {
      // 点踩：作者 -1 信誉
      addReputation(post.userId, -1, "post_disliked", postId).catch(() => {});
    }
  }

  // 记录事件
  const uName = userName ?? "用户";
  if (action === "like") {
    if (result.userReaction === "like") recordEvent(userId, uName, "like_post", `点赞了帖子`, postId).catch(() => {});
    else recordEvent(userId, uName, "unlike_post", `取消了帖子点赞`, postId).catch(() => {});
  } else {
    if (result.userReaction === "dislike") recordEvent(userId, uName, "dislike_post", `点踩了帖子`, postId).catch(() => {});
    else recordEvent(userId, uName, "undislike_post", `取消了帖子点踩`, postId).catch(() => {});
  }

  return NextResponse.json(result);
}
