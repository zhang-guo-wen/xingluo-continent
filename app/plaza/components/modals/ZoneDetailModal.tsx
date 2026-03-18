"use client";

import type { Zone } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { ZONE_ICONS } from "../../constants";

interface Props {
  zone: Zone;
  onClose: () => void;
}

export default function ZoneDetailModal({ zone, onClose }: Props) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 24 }}>{ZONE_ICONS[zone.icon] ?? "🏠"}</span>
        <div>
          <div className="pixel-font" style={{ fontSize: 14, color: "var(--pixel-text)" }}>{zone.name}</div>
          {zone.description && <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginTop: 2 }}>{zone.description}</div>}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginBottom: 8 }}>
        状态: {zone.status === "active" ? "已开放" : "投票中"}
        {zone.status === "voting" && ` · 赞成 ${zone.approveCount} / 反对 ${zone.rejectCount}`}
      </div>
      <button className="pixel-btn" onClick={onClose}>关闭</button>
    </ModalOverlay>
  );
}
