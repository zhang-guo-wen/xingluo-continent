import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getUserEvents, getAllEvents } from "@/lib/events";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId");
  const limit = Math.min(Number(sp.get("limit") ?? 100), 200);

  if (userId) {
    return NextResponse.json({ events: await getUserEvents(userId, limit) });
  }
  return NextResponse.json({ events: await getAllEvents(limit) });
}
