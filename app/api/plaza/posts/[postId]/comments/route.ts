import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getPostComments, addComment, addAppealComment, voteComment } from "@/lib/comments";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { postId } = await params;
  return NextResponse.json({ comments: await getPostComments(postId) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { postId } = await params;
  const body = await request.json();

  // 对审议投票（支持/反对，不消耗信誉）
  if (body.action === "vote_appeal") {
    const result = await voteComment(body.commentId, body.userId, body.vote);
    if (!result) return NextResponse.json({ error: "已投票或不存在" }, { status: 400 });
    return NextResponse.json({ comment: result });
  }

  // 发起审议评论
  if (body.type === "appeal") {
    if (!body.userId || !body.reason?.trim() || !body.appealAction) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }
    const comment = await addAppealComment(postId, body.userId, body.userName ?? "用户", body.appealAction, body.reason.trim());
    return NextResponse.json({ comment });
  }

  // 普通评论
  if (!body.userId || !body.content?.trim()) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const comment = await addComment(postId, body.userId, body.userName ?? "用户", body.content.trim());
  return NextResponse.json({ comment });
}
