"use client";

import { useState } from "react";
import { TILE, NPC_CONFIG } from "../constants";

interface Props {
  onInteract: () => void;
}

export default function NpcBlock({ onInteract }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="user-block"
      style={{ left: NPC_CONFIG.gridX * TILE, top: NPC_CONFIG.gridY * TILE, zIndex: 15 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onInteract(); }}
    >
      {hovered && (
        <div className="user-tooltip" style={{ whiteSpace: "normal", width: 140, textAlign: "center" }}>
          <div style={{ color: "var(--pixel-gold)", fontSize: 12 }}>星域官</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>点击申请创建新区域</div>
        </div>
      )}
      <div
        className="avatar-box"
        style={{ background: "#7c3aed", width: 36, height: 36, border: "2px solid var(--pixel-gold)" }}
      >
        <span style={{ fontSize: 20 }}>👑</span>
      </div>
      <span className="name-tag" style={{ color: "var(--pixel-gold)" }}>{NPC_CONFIG.name}</span>
      <span className="occ-tag" style={{ color: "var(--pixel-muted)" }}>{NPC_CONFIG.title}</span>
    </div>
  );
}
