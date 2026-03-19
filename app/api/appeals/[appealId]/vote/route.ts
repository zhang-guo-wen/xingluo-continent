import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { voteAppeal } from "@/lib/appeals";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appealId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { appealId } = await params;
  const { userId, vote } = await request.json();
  if (!userId || !["support", "oppose"].includes(vote)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const result = await voteAppeal(appealId, userId, vote);
  if (!result) return NextResponse.json({ error: "已投票或审议不存在" }, { status: 400 });
  return NextResponse.json({ appeal: result });
}
