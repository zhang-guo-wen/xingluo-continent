"use client";

import type { PlazaUser } from "@/lib/types";
import { stringToColor } from "@/lib/utils";
import { GRID_COLS, GRID_ROWS } from "../constants";

interface Props {
  users: PlazaUser[];
  totalCount: number;
  hoveredUser: string | null;
  onHover: (id: string | null) => void;
  onRefresh: () => void;
}

export default function UserSidebar({ users, totalCount, hoveredUser, onHover, onRefresh }: Props) {
  return (
    <div
      className="fixed top-2 left-2 z-40 overflow-y-auto"
      style={{
        width: 200,
        maxHeight: "calc(100vh - 80px)",
        background: "rgba(22,33,62,0.9)",
        border: "2px solid var(--pixel-border)",
      }}
    >
      <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: "1px solid var(--pixel-border)" }}>
        <span className="pixel-font" style={{ fontSize: 10, color: "var(--pixel-gold)" }}>
          冒险者 ({totalCount})
        </span>
        <button
          onClick={onRefresh}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--pixel-muted)", padding: 0 }}
          title="刷新，看到其他人"
        >
          🔄
        </button>
      </div>
      {users.length === 0 ? (
        <div className="px-2 py-3 text-center" style={{ fontSize: 12, color: "var(--pixel-muted)" }}>
          还没有其他冒险者
        </div>
      ) : (
        users.map((user, i) => (
          <div
            key={user.id}
            className="flex items-center gap-1.5 px-2 py-1.5"
            style={{
              borderBottom: "1px solid rgba(15,52,96,0.5)",
              cursor: "pointer",
              background: hoveredUser === user.id ? "rgba(107,140,255,0.15)" : "transparent",
            }}
            onMouseEnter={() => onHover(user.id)}
            onMouseLeave={() => onHover(null)}
          >
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 26, height: 26,
                background: user.avatarUrl ? "transparent" : stringToColor(user.name),
                border: "1px solid var(--pixel-border)", fontSize: 12,
              }}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="pixel-avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#fff" }}>{user.name[0]}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div style={{ fontSize: 12, color: "var(--pixel-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name}
              </div>
              {user.occupation && (
                <div style={{ fontSize: 10, color: "var(--pixel-gold)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.occupation}
                </div>
              )}
            </div>
            {i < GRID_COLS * GRID_ROWS && (
              <span style={{ fontSize: 8, color: "var(--pixel-green)" }}>●</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
