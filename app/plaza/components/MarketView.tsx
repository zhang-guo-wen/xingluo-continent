"use client";

import { useEffect, useState } from "react";
import type { UserItem, ItemCategory } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import * as api from "@/lib/api";

const CATEGORIES: { key: ItemCategory | "all"; label: string; icon: string }[] = [
  { key: "all", label: "全部", icon: "🌐" },
  { key: "goods", label: "物品", icon: "📦" },
  { key: "info", label: "信息", icon: "📄" },
  { key: "service", label: "服务", icon: "🛠️" },
  { key: "compute", label: "算力", icon: "⚡" },
];

interface Props {
  currentUserId?: string;
  onBuy?: () => void;
}

export default function MarketView({ currentUserId, onBuy }: Props) {
  const [items, setItems] = useState<UserItem[]>([]);
  const [category, setCategory] = useState<ItemCategory | "all">("all");
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    const cat = category === "all" ? undefined : category;
    api.fetchMarketItems(cat).then(setItems).catch(() => {});
  }, [category]);

  async function handleBuy(item: UserItem) {
    if (!currentUserId || buying) return;
    setBuying(item.id);
    try {
      await api.buyItem(item.id, currentUserId);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onBuy?.();
    } catch (e) {
      alert((e as Error).message.includes("400") ? "余额不足" : "购买失败");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-4" style={{ fontSize: 14 }}>市场</h2>

      {/* 分类筛选 */}
      <div className="flex gap-1 mb-4 p-1 max-w-lg mx-auto overflow-x-auto" style={{ background: "rgba(15,52,96,0.5)" }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className="shrink-0 py-2 px-3 text-center"
            style={{
              fontSize: 11, cursor: "pointer", border: "none",
              background: category === c.key ? "var(--pixel-panel)" : "transparent",
              color: category === c.key ? "var(--pixel-gold)" : "var(--pixel-muted)",
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* 商品列表 */}
      <div className="max-w-lg mx-auto space-y-2">
        {items.length === 0 ? (
          <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
            暂无在售商品
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="pixel-border p-3" style={{ background: "var(--pixel-panel)" }}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>{item.name}</span>
                    <span style={{ fontSize: 10, color: "var(--pixel-muted)" }}>
                      {CATEGORIES.find((c) => c.key === item.category)?.icon}
                    </span>
                  </div>
                  {item.description && (
                    <div style={{ fontSize: 12, color: "var(--pixel-muted)", marginTop: 4 }}>{item.description}</div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--pixel-muted)", marginTop: 4 }}>
                    {timeAgo(item.createdAt)}
                  </div>
                </div>
                <div className="shrink-0 text-right ml-3">
                  <div style={{ fontSize: 16, color: "var(--pixel-gold)", fontWeight: "bold" }}>
                    🪙 {item.price}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--pixel-muted)" }}>{item.tokenSymbol}</div>
                  {item.userId !== currentUserId && (
                    <button
                      className="pixel-btn pixel-btn-accent mt-2"
                      style={{ fontSize: 10, padding: "4px 12px" }}
                      disabled={buying === item.id}
                      onClick={() => handleBuy(item)}
                    >
                      {buying === item.id ? "购买中..." : "购买"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
