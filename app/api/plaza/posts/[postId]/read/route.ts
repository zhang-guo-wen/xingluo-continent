import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { hasReadPost, markPostRead, getAllPosts } from "@/lib/db";
import { transferCoins } from "@/lib/economy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { postId } = await params;
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

  // 已读过则直接返回
  const alreadyRead = await hasReadPost(postId, userId);
  if (alreadyRead) return NextResponse.json({ paid: false, alreadyRead: true });

  // 查帖子价格
  const posts = await getAllPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });

  // 自己的帖子免费
  if (post.userId === userId) {
    await markPostRead(postId, userId, 0);
    return NextResponse.json({ paid: false, alreadyRead: false, free: true });
  }

  // 免费帖子
  if (post.price <= 0) {
    await markPostRead(postId, userId, 0);
    return NextResponse.json({ paid: false, alreadyRead: false, free: true });
  }

  // 付费帖子：转账
  const ok = await transferCoins(userId, post.userId, post.price, "trade", postId);
  if (!ok) {
    return NextResponse.json({ error: "余额不足", required: post.price }, { status: 400 });
  }

  await markPostRead(postId, userId, post.price);
  return NextResponse.json({ paid: true, amount: post.price });
}
