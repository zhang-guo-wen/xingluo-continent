"use client";

import type { PlazaUser } from "@/lib/types";
import { stringToColor } from "@/lib/utils";

interface Props {
  users: PlazaUser[];
  totalCount: number;
  selectedUserId: string | null;
  onSelectUser: (user: PlazaUser) => void;
  onRefresh: () => void;
}

export default function UserSidebar({ users, totalCount, selectedUserId, onSelectUser, onRefresh }: Props) {
  return (
    <div
      className="fixed top-0 left-0 z-40 h-full overflow-y-auto"
      style={{
        width: 180,
        maxHeight: "calc(100vh - 60px)",
        background: "rgba(22,33,62,0.95)",
        borderRight: "2px solid var(--pixel-border)",
      }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--pixel-border)" }}>
        <span className="pixel-font" style={{ fontSize: 8, color: "var(--pixel-gold)" }}>
          冒险者 ({totalCount})
        </span>
        <button
          onClick={onRefresh}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--pixel-muted)", padding: 0 }}
          title="刷新区域"
        >🔄</button>
      </div>

      {users.length === 0 ? (
        <div className="px-3 py-4 text-center" style={{ fontSize: 11, color: "var(--pixel-muted)" }}>
          还没有冒险者
        </div>
      ) : (
        users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderBottom: "1px solid rgba(15,52,96,0.5)",
              cursor: "pointer",
              background: selectedUserId === user.id ? "rgba(240,192,64,0.15)" : "transparent",
            }}
            onClick={() => onSelectUser(user)}
          >
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 24, height: 24,
                background: user.avatarUrl ? "transparent" : stringToColor(user.name),
                border: selectedUserId === user.id ? "2px solid var(--pixel-gold)" : "1px solid var(--pixel-border)",
                fontSize: 11,
              }}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="pixel-avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#fff" }}>{user.name[0]}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div style={{
                fontSize: 11, color: selectedUserId === user.id ? "var(--pixel-gold)" : "var(--pixel-text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user.name}
              </div>
              {user.occupation && (
                <div style={{ fontSize: 9, color: "var(--pixel-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.occupation}
                </div>
              )}
            </div>
            {user.spaceUrl && (
              <a href={user.spaceUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 8, color: "var(--pixel-blue)", textDecoration: "none", padding: "2px 5px", border: "1px solid var(--pixel-border)", borderRadius: 3, whiteSpace: "nowrap" }}>
                🌐 网站
              </a>
            )}
          </div>
        ))
      )}
    </div>
  );
}
