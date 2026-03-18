"use client";

import type { Zone } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { ZONE_ICONS } from "../../constants";

interface Props {
  zones: Zone[];
  onVote: (zoneId: string, vote: "approve" | "reject") => void;
  onClose: () => void;
}

export default function VoteModal({ zones, onVote, onClose }: Props) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>
        区域投票 ({zones.length})
      </div>
      {zones.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--pixel-muted)" }}>暂无待投票区域</p>
      ) : (
        zones.map((zone) => (
          <div key={zone.id} className="pixel-border p-2 mb-2" style={{ background: "var(--pixel-bg)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span>{ZONE_ICONS[zone.icon] ?? "🏠"}</span>
              <span style={{ fontSize: 14, color: "var(--pixel-text)" }}>{zone.name}</span>
              <span className="ml-auto" style={{ width: 14, height: 14, background: zone.color, display: "inline-block" }} />
            </div>
            {zone.description && <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginBottom: 4 }}>{zone.description}</div>}
            <div style={{ fontSize: 12, color: "var(--pixel-muted)", marginBottom: 4 }}>赞成 {zone.approveCount} · 反对 {zone.rejectCount}</div>
            <div className="flex gap-2">
              <button className="pixel-btn pixel-btn-green" onClick={() => onVote(zone.id, "approve")}>👍 赞成</button>
              <button className="pixel-btn pixel-btn-accent" onClick={() => onVote(zone.id, "reject")}>👎 反对</button>
            </div>
          </div>
        ))
      )}
      <button className="pixel-btn mt-2" onClick={onClose}>关闭</button>
    </ModalOverlay>
  );
}
