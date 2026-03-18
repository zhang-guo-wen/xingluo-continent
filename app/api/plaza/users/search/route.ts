import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { searchUsers } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const users = await searchUsers({
    name: sp.get("name") ?? undefined,
    occupation: sp.get("occupation") ?? undefined,
    description: sp.get("description") ?? undefined,
    cityId: sp.get("cityId") ?? undefined,
    limit: Math.min(Number(sp.get("limit") ?? 1000), 1000),
  });

  return NextResponse.json({ users, total: users.length });
}
