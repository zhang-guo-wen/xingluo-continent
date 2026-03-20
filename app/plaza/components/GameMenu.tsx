"use client";

export type MenuTab = "forum" | "camp" | "world" | "friends" | "market" | "rank" | "me";

const TABS: { key: MenuTab; icon: string; label: string }[] = [
  { key: "forum", icon: "📋", label: "论坛" },
  { key: "camp", icon: "⛺", label: "营地" },
  { key: "world", icon: "🌌", label: "世界" },
  { key: "friends", icon: "👫", label: "好友" },
  { key: "market", icon: "🏪", label: "市场" },
  { key: "rank", icon: "🏆", label: "排行" },
  { key: "me", icon: "👤", label: "我" },
];

interface Props {
  active: MenuTab;
  onChange: (tab: MenuTab) => void;
}

export default function GameMenu({ active, onChange }: Props) {
  return (
    <div className="game-menu">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`game-menu-item ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          <span className="icon">{t.icon}</span>
          <span className="label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
