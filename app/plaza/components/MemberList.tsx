"use client";

import type { PlazaUser } from "@/lib/types";
import { timeAgo, stringToColor } from "@/lib/utils";

interface Props {
  users: PlazaUser[];
}

export default function MemberList({ users }: Props) {
  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-4" style={{ fontSize: 14 }}>冒险者 ({users.length})</h2>
      <div className="max-w-lg mx-auto space-y-2">
        {users.map((user) => (
          <div key={user.id} className="pixel-border p-3 flex items-center gap-3" style={{ background: "var(--pixel-panel)" }}>
            <div
              className="w-10 h-10 flex items-center justify-center text-lg shrink-0"
              style={{ background: user.avatarUrl ? "transparent" : stringToColor(user.name), border: "2px solid var(--pixel-border)" }}
            >
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" className="pixel-avatar w-full h-full object-cover" />
                : user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 14 }}>{user.name}</span>
                <span style={{ fontSize: 11, color: "var(--pixel-muted)" }}>{user.userNo}</span>
              </div>
              {user.occupation && <div style={{ fontSize: 13, color: "var(--pixel-gold)" }}>{user.occupation}</div>}
              {user.description && (
                <div style={{ fontSize: 13, color: "var(--pixel-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.description}</div>
              )}
              <div style={{ fontSize: 12, color: "var(--pixel-muted)", marginTop: 2 }}>
                信誉 {user.reputation} · 金币 {user.coins} · {timeAgo(user.joinedAt)}加入
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
