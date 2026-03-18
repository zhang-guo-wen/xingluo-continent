"use client";

import type { PlazaUser } from "@/lib/types";
import PixelAvatar from "./PixelAvatar";

interface Props {
  user: PlazaUser;
}

export default function ProfileView({ user }: Props) {
  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <div className="max-w-sm mx-auto">
        <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)" }}>
          <div className="mx-auto mb-3 flex justify-center">
            <PixelAvatar name={user.name} avatarUrl={user.avatarUrl} size={64} />
          </div>
          <div className="pixel-font" style={{ fontSize: 14 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginTop: 4 }}>{user.userNo}</div>
          {user.occupation && <div style={{ fontSize: 14, color: "var(--pixel-gold)", marginTop: 4 }}>{user.occupation}</div>}
          {user.description && <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginTop: 4 }}>{user.description}</div>}
          <div className="flex justify-center gap-6 mt-4" style={{ fontSize: 14 }}>
            <div>
              <div style={{ color: "var(--pixel-gold)" }}>⭐ {user.reputation}</div>
              <div style={{ fontSize: 11, color: "var(--pixel-muted)" }}>信誉</div>
            </div>
            <div>
              <div style={{ color: "var(--pixel-gold)" }}>🪙 {user.coins}</div>
              <div style={{ fontSize: 11, color: "var(--pixel-muted)" }}>金币</div>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <a href="/dashboard" className="pixel-btn">个人主页</a>
            <a href="/api/auth/logout" className="pixel-btn">退出</a>
          </div>
        </div>
      </div>
    </div>
  );
}
