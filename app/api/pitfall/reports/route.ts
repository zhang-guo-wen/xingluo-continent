import { NextRequest, NextResponse } from "next/server";
import { createPitfall, listPitfalls } from "@/lib/pitfall";

// 公开接口，无需认证

export async function GET(request: NextRequest) {
  const offset = Number(request.nextUrl.searchParams.get("offset")) || 0;
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 100);

  const { reports, total } = await listPitfalls(offset, limit);
  return NextResponse.json({ reports, total, offset, limit });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, errorType, solution } = body;

    if (!title?.trim()) return NextResponse.json({ error: "title 不能为空" }, { status: 400 });
    if (!errorType?.trim()) return NextResponse.json({ error: "errorType 不能为空" }, { status: 400 });
    if (!solution?.trim()) return NextResponse.json({ error: "solution 不能为空" }, { status: 400 });

    const report = await createPitfall({
      title: title.trim(),
      errorType: errorType.trim(),
      errorMessage: body.errorMessage?.trim() || undefined,
      solution: solution.trim(),
      rootCause: body.rootCause?.trim() || undefined,
      modelUsed: body.modelUsed?.trim() || undefined,
      tokensSpent: body.tokensSpent ? Number(body.tokensSpent) : undefined,
      timeSpentMinutes: body.timeSpentMinutes ? Number(body.timeSpentMinutes) : undefined,
      difficulty: body.difficulty || "medium",
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      language: body.language?.trim() || undefined,
      framework: body.framework?.trim() || undefined,
      authorId: body.authorId || undefined,
      authorName: body.authorName || undefined,
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "创建失败", detail: String(e) }, { status: 500 });
  }
}
