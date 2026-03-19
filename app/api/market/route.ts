import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getMarketItems } from "@/lib/profile";
import type { ItemCategory } from "@/lib/types";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const category = sp.get("category") as ItemCategory | null;
  const sort = sp.get("sort") ?? "new";
  const limit = Math.min(Number(sp.get("limit") ?? 50), 100);

  let items = await getMarketItems(category ?? undefined, limit);

  if (sort === "price") items.sort((a, b) => b.price - a.price);
  // "new" is default (already sorted by created_at DESC)

  return NextResponse.json({ items });
}
