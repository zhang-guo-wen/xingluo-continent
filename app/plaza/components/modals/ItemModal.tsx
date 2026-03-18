"use client";

import { useState } from "react";
import type { ItemCategory } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";

const CATEGORIES: { key: ItemCategory; label: string; icon: string }[] = [
  { key: "goods", label: "物品", icon: "📦" },
  { key: "info", label: "信息", icon: "📄" },
  { key: "service", label: "服务", icon: "🛠️" },
  { key: "compute", label: "算力", icon: "⚡" },
];

interface Props {
  onSubmit: (data: { name: string; description?: string; category: ItemCategory; price: number }) => Promise<void>;
  onClose: () => void;
}

export default function ItemModal({ onSubmit, onClose }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<ItemCategory>("goods");
  const [price, setPrice] = useState("");

  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>上架商品</div>
      <input className="pixel-input mb-2" placeholder="商品名称" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="pixel-textarea mb-2" rows={2} placeholder="商品描述" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="mb-2" style={{ fontSize: 13, color: "var(--pixel-muted)" }}>类别</div>
      <div className="flex gap-1 mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className="pixel-btn"
            style={{
              fontSize: 11, padding: "6px 10px",
              background: category === c.key ? "var(--pixel-accent)" : undefined,
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input
          className="pixel-input"
          type="number"
          placeholder="价格"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{ width: "50%" }}
        />
        <span style={{ fontSize: 13, color: "var(--pixel-gold)" }}>XLC（星罗币）</span>
      </div>
      <div className="flex gap-2">
        <button
          className="pixel-btn pixel-btn-green"
          onClick={() => onSubmit({ name, description: desc || undefined, category, price: Number(price) || 0 })}
          disabled={!name.trim()}
        >
          上架
        </button>
        <button className="pixel-btn" onClick={onClose}>取消</button>
      </div>
    </ModalOverlay>
  );
}
