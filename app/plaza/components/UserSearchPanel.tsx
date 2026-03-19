"use client";

import { useState } from "react";
import type { PlazaUser } from "@/lib/types";
import { stringToColor } from "@/lib/utils";
import * as api from "@/lib/api";

export default function UserSearchPanel() {
  const [query, setQuery] = useState("");
  const [searchBy, setSearchBy] = useState<"name" | "occupation" | "description">("name");
  const [results, setResults] = useState<PlazaUser[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params: Record<string, string> = {};
      params[searchBy] = query.trim();
      const users = await api.searchUsers({ ...params, limit: 100 });
      setResults(users);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-4" style={{ fontSize: 14 }}>搜索冒险者</h2>

      <div className="max-w-lg mx-auto">
        {/* 搜索类型 */}
        <div className="flex gap-1 mb-2 p-1" style={{ background: "rgba(15,52,96,0.5)" }}>
          {([
            { key: "name" as const, label: "名字" },
            { key: "occupation" as const, label: "职位" },
            { key: "description" as const, label: "描述" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setSearchBy(t.key)}
              className="flex-1 py-1.5 text-center"
              style={{
                fontSize: 11, cursor: "pointer", border: "none",
                background: searchBy === t.key ? "var(--pixel-panel)" : "transparent",
                color: searchBy === t.key ? "var(--pixel-gold)" : "var(--pixel-muted)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 搜索框 */}
        <div className="flex gap-2 mb-4">
          <input
            className="pixel-input flex-1"
            placeholder={`搜索${searchBy === "name" ? "名字" : searchBy === "occupation" ? "职位" : "描述"}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="pixel-btn pixel-btn-accent" onClick={handleSearch} disabled={searching} style={{ fontSize: 12 }}>
            {searching ? "..." : "搜索"}
          </button>
        </div>

        {/* 结果 */}
        {results !== null && (
          <>
            <div className="mb-2" style={{ fontSize: 12, color: "var(--pixel-muted)" }}>
              找到 {results.length} 人
            </div>
            <div className="space-y-2">
              {results.map((user) => (
                <div key={user.id} className="pixel-border p-3 flex items-center gap-3" style={{ background: "var(--pixel-panel)" }}>
                  <div
                    className="w-8 h-8 flex items-center justify-center shrink-0"
                    style={{ background: user.avatarUrl ? "transparent" : stringToColor(user.name), border: "1px solid var(--pixel-border)", fontSize: 14 }}
                  >
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="pixel-avatar w-full h-full object-cover" /> : user.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13 }}>{user.name}</span>
                      <span style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{user.userNo}</span>
                    </div>
                    {user.occupation && <div style={{ fontSize: 11, color: "var(--pixel-gold)" }}>{user.occupation}</div>}
                    {user.description && (
                      <div style={{ fontSize: 11, color: "var(--pixel-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.description}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--pixel-muted)", textAlign: "right" }}>
                    <div>⭐ {user.reputation}</div>
                    <div>🪙 {user.coins}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
