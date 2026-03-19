"use client";

import { useEffect, useState } from "react";
import type { UserFriend, PlazaUser } from "@/lib/types";
import { stringToColor } from "@/lib/utils";
import * as api from "@/lib/api";

interface Props {
  currentUserId: string;
  onSelectUser?: (user: PlazaUser) => void;
}

export default function FriendsView({ currentUserId, onSelectUser }: Props) {
  const [friends, setFriends] = useState<UserFriend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlazaUser[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.fetchFriends(currentUserId).then(setFriends).catch(() => {});
  }, [currentUserId]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const users = await api.searchUsers({ name: searchQuery.trim(), limit: 20 });
      setSearchResults(users.filter((u) => u.id !== currentUserId));
    } finally {
      setSearching(false);
    }
  }

  async function handleAddFriend(friendId: string) {
    await api.addFriend(currentUserId, friendId);
    api.fetchFriends(currentUserId).then(setFriends).catch(() => {});
  }

  async function handleRemoveFriend(friendId: string) {
    await api.removeFriend(currentUserId, friendId);
    setFriends((prev) => prev.filter((f) => f.friendId !== friendId));
  }

  const friendIds = new Set(friends.map((f) => f.friendId));

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-4" style={{ fontSize: 14 }}>好友</h2>

      {/* 搜索添加好友 */}
      <div className="max-w-lg mx-auto mb-4">
        <div className="flex gap-2">
          <input
            className="pixel-input flex-1"
            placeholder="搜索用户名添加好友..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="pixel-btn pixel-btn-accent" onClick={handleSearch} disabled={searching} style={{ fontSize: 11 }}>
            {searching ? "..." : "🔍 搜索"}
          </button>
        </div>

        {searchResults && (
          <div className="mt-2 space-y-1">
            {searchResults.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--pixel-muted)", textAlign: "center", padding: 8 }}>没有找到用户</div>
            ) : (
              searchResults.map((user) => (
                <div key={user.id} className="pixel-border p-2 flex items-center gap-2" style={{ background: "var(--pixel-panel)" }}>
                  <div className="w-7 h-7 flex items-center justify-center shrink-0"
                    style={{ background: user.avatarUrl ? "transparent" : stringToColor(user.name), border: "1px solid var(--pixel-border)", fontSize: 12 }}>
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="pixel-avatar w-full h-full object-cover" /> : user.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12 }}>{user.name}</div>
                    {user.occupation && <div style={{ fontSize: 10, color: "var(--pixel-gold)" }}>{user.occupation}</div>}
                  </div>
                  {friendIds.has(user.id) ? (
                    <span style={{ fontSize: 10, color: "var(--pixel-green)" }}>已是好友</span>
                  ) : (
                    <button className="pixel-btn pixel-btn-green" style={{ fontSize: 9, padding: "3px 8px" }}
                      onClick={() => handleAddFriend(user.id)}>+ 添加</button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 好友列表 */}
      <div className="max-w-lg mx-auto">
        <div className="mb-2" style={{ fontSize: 13 }}>我的好友 ({friends.length})</div>
        {friends.length === 0 ? (
          <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
            还没有好友，搜索添加吧
          </div>
        ) : (
          <div className="space-y-1">
            {friends.map((f) => (
              <div key={f.friendId} className="pixel-border p-2 flex items-center gap-2" style={{ background: "var(--pixel-panel)" }}>
                <div className="w-7 h-7 flex items-center justify-center shrink-0"
                  style={{ background: stringToColor(f.friendName), border: "1px solid var(--pixel-border)", fontSize: 12 }}>
                  {f.friendName[0]}
                </div>
                <div className="flex-1 min-w-0" style={{ cursor: "pointer" }}
                  onClick={() => {
                    // 查找完整用户信息
                    api.searchUsers({ name: f.friendName, limit: 1 }).then((users) => {
                      const u = users.find((x) => x.id === f.friendId);
                      if (u && onSelectUser) onSelectUser(u);
                    });
                  }}>
                  <div style={{ fontSize: 12 }}>{f.friendName}</div>
                </div>
                <button
                  onClick={() => handleRemoveFriend(f.friendId)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--pixel-accent)" }}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
