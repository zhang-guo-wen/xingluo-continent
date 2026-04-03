import { NextRequest, NextResponse } from "next/server";
import { getPitfall } from "@/lib/pitfall";

// 公开接口，无需认证

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getPitfall(id);
  if (!report) return NextResponse.json({ error: "未找到该踩坑经验" }, { status: 404 });
  return NextResponse.json({ report });
}
