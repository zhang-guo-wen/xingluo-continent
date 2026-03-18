import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getUserItems, createItem, buyItem, getMarketItems } from "@/lib/profile";

export async function GET(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId");
  const market = sp.get("market");

  if (market === "true") {
    const category = sp.get("category") as "goods" | "info" | "service" | "compute" | null;
    return NextResponse.json({ items: await getMarketItems(category ?? undefined) });
  }
  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  return NextResponse.json({ items: await getUserItems(userId) });
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();

  // 购买商品
  if (body.action === "buy") {
    const item = await buyItem(body.itemId, body.buyerId, body.txHash);
    if (!item) return NextResponse.json({ error: "商品不存在或已售出" }, { status: 400 });
    return NextResponse.json({ item });
  }

  // 上架商品
  const { userId, name, description, category, price, tokenSymbol } = body;
  if (!userId || !name?.trim()) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const item = await createItem({
    userId, name: name.trim(), description: description?.trim(),
    category: category ?? "goods", price: price ?? 0, tokenSymbol,
  });
  return NextResponse.json({ item });
}
