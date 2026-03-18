"use client";

import type { PlazaUser } from "@/lib/types";
import PixelAvatar from "./PixelAvatar";

interface Props {
  user: PlazaUser;
  x: number;
  y: number;
  hovered: boolean;
  highlight?: boolean;
  onHover: (id: string | null) => void;
}

export default function UserBlock({ user, x, y, hovered, highlight, onHover }: Props) {
  return (
    <div
      className="user-block"
      style={{ left: x, top: y, zIndex: highlight ? 10 : undefined }}
      onMouseEnter={() => onHover(user.id)}
      onMouseLeave={() => onHover(null)}
    >
      {hovered && (
        <div className="user-tooltip">
          <div style={{ fontSize: 12, color: "var(--pixel-gold)", marginBottom: 2 }}>
            {highlight ? "你自己" : user.userNo}
          </div>
          {user.description && <div style={{ fontSize: 13 }}>{user.description}</div>}
          {!highlight && (
            <div style={{ fontSize: 12, color: "var(--pixel-muted)", marginTop: 2 }}>
              信誉 {user.reputation} · 金币 {user.coins}
            </div>
          )}
        </div>
      )}
      <PixelAvatar
        name={user.name}
        avatarUrl={user.avatarUrl}
        size={highlight ? 36 : 40}
        highlight={highlight}
      />
      <span className="name-tag" style={highlight ? { color: "var(--pixel-gold)" } : undefined}>
        {user.name}
      </span>
      {user.occupation && <span className="occ-tag">{user.occupation}</span>}
    </div>
  );
}
