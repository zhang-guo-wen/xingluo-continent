import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { voteCity } from "@/lib/cities";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cityId } = await params;
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const result = await voteCity(cityId, userId);
  return NextResponse.json(result);
}
