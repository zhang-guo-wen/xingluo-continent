"use client";

import { useState } from "react";
import ModalOverlay from "./ModalOverlay";
import { ZONE_COLORS, ZONE_ICONS } from "../../constants";

interface Props {
  onSubmit: (data: { name: string; description?: string; color: string; icon: string }) => Promise<void>;
  onClose: () => void;
}

export default function ZoneModal({ onSubmit, onClose }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(ZONE_COLORS[1]);
  const [icon, setIcon] = useState("house");

  async function handleSubmit() {
    if (!name.trim()) return;
    await onSubmit({ name, description: desc || undefined, color, icon });
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 20 }}>👑</span>
        <div className="pixel-font" style={{ fontSize: 14, color: "var(--pixel-gold)" }}>星域官 · 区域申请</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginBottom: 8, lineHeight: 1.6 }}>
        冒险者，欢迎申请开辟新区域。提交后将进入全体投票，10% 冒险者赞成即可在地图上开放。
      </div>
      <input className="pixel-input mb-2" placeholder="区域名称" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="pixel-textarea mb-2" rows={2} placeholder="区域描述（可选）" value={desc} onChange={(e) => setDesc(e.target.value)} />

      <div className="mb-2" style={{ fontSize: 13, color: "var(--pixel-muted)" }}>选择颜色</div>
      <div className="flex gap-1 mb-3">
        {ZONE_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)}
            style={{ width: 28, height: 28, background: c, border: "none", cursor: "pointer", outline: color === c ? "2px solid #fff" : "none" }} />
        ))}
      </div>

      <div className="mb-2" style={{ fontSize: 13, color: "var(--pixel-muted)" }}>选择图标</div>
      <div className="flex gap-1 mb-3">
        {Object.entries(ZONE_ICONS).map(([key, emoji]) => (
          <button key={key} onClick={() => setIcon(key)}
            style={{ width: 36, height: 36, background: icon === key ? "var(--pixel-border)" : "transparent", border: "none", cursor: "pointer", fontSize: 20 }}>
            {emoji}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="pixel-btn pixel-btn-green" onClick={handleSubmit} disabled={!name.trim()}>提交申请</button>
        <button className="pixel-btn" onClick={onClose}>取消</button>
      </div>
    </ModalOverlay>
  );
}
