"use client";

import { useEffect, useState, useCallback } from "react";
import type { PlazaUser, PlazaPostWithReactions, City, ReactionType } from "@/lib/types";
import { hashStr } from "@/lib/utils";
import * as api from "@/lib/api";
import { MAX_USERS, ZONE_ICONS } from "./constants";

import GameMenu, { type MenuTab } from "./components/GameMenu";
import ActionFab from "./components/ActionFab";
import MapGrid from "./components/MapGrid";
import UserSidebar from "./components/UserSidebar";
import UserDetailPanel from "./components/UserDetailPanel";
import NpcBlock from "./components/NpcBlock";
import PostFeed from "./components/PostFeed";
import UserSearchPanel from "./components/UserSearchPanel";
import ProfileView from "./components/ProfileView";
import LeaderboardView from "./components/LeaderboardView";
import MarketView from "./components/MarketView";

import PostModal from "./components/modals/PostModal";
import ZoneModal from "./components/modals/ZoneModal";
import VoteModal from "./components/modals/VoteModal";
import ZoneDetailModal from "./components/modals/ZoneDetailModal";

export default function PlazaClient() {
  const [users, setUsers] = useState<PlazaUser[]>([]);
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [zones, setZones] = useState<City[]>([]);
  const [currentUser, setCurrentUser] = useState<PlazaUser | null>(null);

  const [visibleSeed, setVisibleSeed] = useState(0);
  const [selectedUser, setSelectedUser] = useState<PlazaUser | null>(null);

  const [menuTab, setMenuTab] = useState<MenuTab>("map");
  const [selectedZone, setSelectedZone] = useState<City | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);

  // ============ 数据 ============

  const fetchAll = useCallback(async (userId?: string) => {
    const [u, p, z] = await Promise.all([
      api.fetchPlazaUsers(),
      api.fetchPosts(userId),
      api.fetchZones(),
    ]);
    setUsers(u);
    setPosts(p);
    setZones(z);
  }, []);

  useEffect(() => {
    api.fetchCurrentUser().then((raw) => {
      if (!raw) return;
      const u: PlazaUser = {
        id: raw.id ?? raw.email ?? "unknown",
        userNo: "", name: raw.name ?? raw.nickname ?? "匿名",
        occupation: null, description: null,
        avatarUrl: raw.avatarUrl ?? null, route: raw.route ?? null,
        walletAddress: null, cityId: "xingluo",
        reputation: 0, coins: 0, compute: 0, joinedAt: "",
      };
      setCurrentUser(u);
      fetchAll(u.id);
    });
  }, [fetchAll]);

  // ============ 可见用户 ============

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);
  const shuffled = [...otherUsers].sort(
    (a, b) => hashStr(a.id + visibleSeed) - hashStr(b.id + visibleSeed)
  );
  // 最多 255 个其他人 + 自己 = 256
  const visibleOthers = shuffled.slice(0, MAX_USERS - 1);
  const allVisible = currentUser ? [currentUser, ...visibleOthers] : visibleOthers;
  const votingZones = zones.filter((z) => z.status === "voting");

  // ============ 回调 ============

  async function handlePost(content: string) {
    if (!currentUser) return;
    await api.createPost({ userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatarUrl, content });
    setShowPostModal(false);
    fetchAll(currentUser.id);
  }

  async function handleProposeZone(data: { name: string; description?: string; color: string; icon: string }) {
    if (!currentUser) return;
    await api.proposeZone({ ...data, creatorId: currentUser.id });
    setShowZoneModal(false);
    fetchAll(currentUser.id);
  }

  async function handleVote(cityId: string) {
    if (!currentUser) return;
    await api.voteCity(cityId, currentUser.id);
    fetchAll(currentUser.id);
  }

  async function handleReact(postId: string, action: ReactionType) {
    if (!currentUser) return;
    const data = await api.reactToPost(postId, currentUser.id, action);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes: data.likes, dislikes: data.dislikes, userReaction: data.userReaction }
          : p
      )
    );
  }

  // ============ 渲染 ============

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--pixel-bg)" }}>

      {/* === 地图 === */}
      {menuTab === "map" && (
        <>
          {/* 左侧冒险者列表 */}
          <UserSidebar
            users={visibleOthers}
            totalCount={otherUsers.length}
            selectedUserId={selectedUser?.id ?? null}
            onSelectUser={setSelectedUser}
            onRefresh={() => { setVisibleSeed((s) => s + 1); setSelectedUser(null); }}
          />

          {/* 中心地图 */}
          <div
            className="absolute overflow-auto scanlines"
            style={{
              left: 180, right: selectedUser ? 280 : 0,
              top: 0, bottom: 56,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{ padding: 16 }}>
              {/* 区域标题 */}
              <div className="text-center mb-3">
                <span className="pixel-font" style={{ fontSize: 14, color: "var(--pixel-gold)" }}>
                  {ZONE_ICONS["castle"]} 星罗城
                </span>
                <span style={{ fontSize: 11, color: "var(--pixel-muted)", marginLeft: 8 }}>
                  {allVisible.length}/{MAX_USERS} 冒险者
                </span>
              </div>

              <MapGrid
                users={allVisible}
                currentUser={currentUser}
                selectedUserId={selectedUser?.id ?? null}
                onSelectUser={setSelectedUser}
              />

              {/* NPC 在地图下方 */}
              <div className="flex justify-center mt-4 gap-4">
                <button
                  className="pixel-btn pixel-btn-green"
                  style={{ fontSize: 11 }}
                  onClick={() => setShowZoneModal(true)}
                >
                  👑 星域官 · 申请建城
                </button>
                {votingZones.length > 0 && (
                  <button
                    className="pixel-btn"
                    style={{ fontSize: 11 }}
                    onClick={() => setShowVoteModal(true)}
                  >
                    🗳️ 投票 ({votingZones.length})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 右侧用户详情面板 */}
          {selectedUser && (
            <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
          )}
        </>
      )}

      {/* === 其他 tab === */}
      {menuTab === "posts" && <PostFeed posts={posts} onReact={handleReact} />}
      {menuTab === "market" && <MarketView currentUserId={currentUser?.id} onBuy={() => fetchAll(currentUser?.id)} />}
      {menuTab === "search" && <UserSearchPanel />}
      {menuTab === "rank" && <LeaderboardView currentUserId={currentUser?.id} />}
      {menuTab === "me" && currentUser && <ProfileView user={currentUser} onUserUpdate={setCurrentUser} />}

      {/* === 导航 === */}
      <GameMenu active={menuTab} onChange={(t) => { setMenuTab(t); setSelectedUser(null); }} />
      <ActionFab votingCount={votingZones.length} onPost={() => setShowPostModal(true)} onVote={() => setShowVoteModal(true)} />

      {/* === 弹窗 === */}
      {showPostModal && <PostModal onSubmit={handlePost} onClose={() => setShowPostModal(false)} />}
      {showZoneModal && <ZoneModal onSubmit={handleProposeZone} onClose={() => setShowZoneModal(false)} />}
      {showVoteModal && <VoteModal zones={votingZones} onVote={handleVote} onClose={() => setShowVoteModal(false)} />}
      {selectedZone && <ZoneDetailModal zone={selectedZone} onClose={() => setSelectedZone(null)} />}
    </div>
  );
}
