"use client";

import { stringToColor } from "@/lib/utils";

interface Props {
  name: string;
  avatarUrl: string | null;
  size?: number;
  highlight?: boolean;
}

export default function PixelAvatar({ name, avatarUrl, size = 40, highlight }: Props) {
  return (
    <div
      className="avatar-box"
      style={{
        width: size,
        height: size,
        background: avatarUrl ? "transparent" : stringToColor(name),
        ...(highlight
          ? { border: "2px solid var(--pixel-gold)", boxShadow: "0 0 8px rgba(240,192,64,0.5)" }
          : {}),
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="pixel-avatar w-full h-full object-cover" />
      ) : (
        <span style={{ color: "#fff", fontSize: size * 0.45 }}>{name[0]}</span>
      )}
    </div>
  );
}
