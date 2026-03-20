"use client";

import { useEffect, useState } from "react";
import type { PlazaUser, LeaderboardType } from "@/lib/types";
import * as api from "@/lib/api";
import PixelAvatar from "./PixelAvatar";

const TABS: { key: LeaderboardType; icon: string; label: string }[] = [
  { key: "reputation", icon: "⭐", label: "信誉" },
  { key: "coins", icon: "🪙", label: "金币" },
  { key: "compute", icon: "⚡", label: "算力" },
  { key: "space_visits", icon: "🚀", label: "空间" },
];

const CROWNS = ["👑", "🥈", "🥉"];

interface Props {
  currentUserId?: string;
}

export default function LeaderboardView({ currentUserId }: Props) {
  const [tab, setTab] = useState<LeaderboardType>("reputation");
  const [users, setUsers] = useState<PlazaUser[]>([]);

  useEffect(() => {
    api.fetchLeaderboard(tab).then(setUsers).catch(() => {});
  }, [tab]);

  function getValue(u: PlazaUser): number {
    if (tab === "reputation") return u.reputation;
    if (tab === "coins") return u.coins;
    if (tab === "compute") return u.compute;
    return u.spaceVisits;
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-4" style={{ fontSize: 14 }}>排行榜</h2>

      <div className="flex gap-1 mb-4 p-1 max-w-lg mx-auto" style={{ background: "rgba(15,52,96,0.5)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2 text-center"
            style={{
              fontSize: 12, cursor: "pointer", border: "none",
              background: tab === t.key ? "var(--pixel-panel)" : "transparent",
              color: tab === t.key ? "var(--pixel-gold)" : "var(--pixel-muted)",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto space-y-2">
        {users.map((user, i) => (
          <div
            key={user.id}
            className="pixel-border p-3 flex items-center gap-3"
            style={{
              background: user.id === currentUserId ? "rgba(107,140,255,0.15)" : "var(--pixel-panel)",
              borderColor: user.id === currentUserId ? "var(--pixel-gold)" : undefined,
            }}
          >
            <div style={{ width: 28, textAlign: "center", fontSize: 14, color: i < 3 ? "var(--pixel-gold)" : "var(--pixel-muted)" }}>
              {i < 3 ? CROWNS[i] : `#${i + 1}`}
            </div>
            <PixelAvatar name={user.name} avatarUrl={user.avatarUrl} size={32} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13 }}>{user.name}</span>
                {user.occupation && <span style={{ fontSize: 10, color: "var(--pixel-gold)" }}>{user.occupation}</span>}
              </div>
              <div style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{user.userNo}</div>
            </div>
            <div style={{ fontSize: 14, color: "var(--pixel-gold)", fontWeight: "bold" }}>
              {getValue(user).toLocaleString()}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center" style={{ fontSize: 13, color: "var(--pixel-muted)" }}>暂无数据</div>
        )}
      </div>
    </div>
  );
}
