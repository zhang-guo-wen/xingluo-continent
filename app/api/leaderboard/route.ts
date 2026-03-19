import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getLeaderboard } from "@/lib/economy";
import type { LeaderboardType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const type = (request.nextUrl.searchParams.get("type") ?? "reputation") as LeaderboardType;
  return NextResponse.json({ users: await getLeaderboard(type) });
}
