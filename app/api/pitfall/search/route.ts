import { NextRequest, NextResponse } from "next/server";
import { searchPitfalls } from "@/lib/pitfall";

// 公开接口，无需认证

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "缺少搜索关键词 q" }, { status: 400 });

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 10, 50);
  const reports = await searchPitfalls(q, limit);
  return NextResponse.json({ reports, query: q });
}
