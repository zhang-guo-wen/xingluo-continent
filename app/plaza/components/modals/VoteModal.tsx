"use client";

import type { City } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { ZONE_ICONS } from "../../constants";

interface Props {
  zones: City[];
  onVote: (cityId: string) => void;
  onClose: () => void;
}

export default function VoteModal({ zones, onVote, onClose }: Props) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-text)" }}>
        建城投票 ({zones.length})
      </div>
      {zones.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--pixel-muted)" }}>暂无待建城市</p>
      ) : (
        zones.map((city) => (
          <div key={city.id} className="pixel-border p-2 mb-2" style={{ background: "var(--pixel-bg)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span>{ZONE_ICONS[city.icon] ?? "🏠"}</span>
              <span style={{ fontSize: 14, color: "var(--pixel-text)" }}>{city.name}</span>
              <span className="ml-auto" style={{ width: 14, height: 14, background: city.color, display: "inline-block" }} />
            </div>
            {city.description && <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginBottom: 4 }}>{city.description}</div>}
            <div style={{ fontSize: 12, color: "var(--pixel-muted)", marginBottom: 4 }}>
              支持 {city.voteCount} / {city.voteThreshold} · 容量 {city.capacity.toLocaleString()}
            </div>
            <button className="pixel-btn pixel-btn-green" onClick={() => onVote(city.id)}>👍 支持建城</button>
          </div>
        ))
      )}
      <button className="pixel-btn mt-2" onClick={onClose}>关闭</button>
    </ModalOverlay>
  );
}
