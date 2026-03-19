import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getUserItems, createItem, buyItem, getMarketItems } from "@/lib/profile";
import { transferCoins, addReputation, addCompute } from "@/lib/economy";

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
    // 先查商品信息
    const item = await buyItem(body.itemId, body.buyerId, body.txHash);
    if (!item) return NextResponse.json({ error: "商品不存在或已售出" }, { status: 400 });

    // 真实转账
    if (item.price > 0) {
      const ok = await transferCoins(body.buyerId, item.userId, item.price, "trade", item.id);
      if (!ok) return NextResponse.json({ error: "余额不足" }, { status: 400 });
    }

    // 信誉奖励：卖家 +5
    await addReputation(item.userId, 5, "sell_item", item.id);

    // 算力类商品：买家获得等值算力
    if (item.category === "compute") {
      await addCompute(body.buyerId, item.price);
    }

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
