"use client";

import { useEffect, useState, useCallback } from "react";
import type { PlazaUser, PlazaPostWithReactions, City, ReactionType } from "@/lib/types";
import { hashStr } from "@/lib/utils";
import * as api from "@/lib/api";
import { MAX_USERS } from "./constants";

import GameMenu, { type MenuTab } from "./components/GameMenu";
import MapGrid from "./components/MapGrid";
import CityMapView from "./components/CityMapView";
import UserSidebar from "./components/UserSidebar";
import UserDetailPanel from "./components/UserDetailPanel";
import PostFeed from "./components/PostFeed";
import UserSearchPanel from "./components/UserSearchPanel";
import ProfileView from "./components/ProfileView";
import LeaderboardView from "./components/LeaderboardView";
import MarketView from "./components/MarketView";

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

  // 地图双层：area=区域(人), cities=城市列表
  const [mapLayer, setMapLayer] = useState<"area" | "cities">("area");

  const [menuTab, setMenuTab] = useState<MenuTab>("map");
  const [selectedZone, setSelectedZone] = useState<City | null>(null);
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
  const visibleOthers = shuffled.slice(0, MAX_USERS - 1);
  const allVisible = currentUser ? [currentUser, ...visibleOthers] : visibleOthers;
  const votingZones = zones.filter((z) => z.status === "voting");

  // ============ 回调 ============

  async function handlePost(content: string) {
    if (!currentUser) return;
    await api.createPost({ userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatarUrl, content });
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

  function handleMapTabClick() {
    if (menuTab === "map") {
      // 已在地图页，切换 area ↔ cities
      setMapLayer((l) => l === "area" ? "cities" : "area");
      setSelectedUser(null);
    } else {
      setMenuTab("map");
    }
  }

  // ============ 渲染 ============

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--pixel-bg)" }}>

      {/* === 地图：区域层 === */}
      {menuTab === "map" && mapLayer === "area" && (
        <>
          <UserSidebar
            users={visibleOthers}
            totalCount={otherUsers.length}
            selectedUserId={selectedUser?.id ?? null}
            onSelectUser={setSelectedUser}
            onRefresh={() => { setVisibleSeed((s) => s + 1); setSelectedUser(null); }}
          />

          <div
            className="absolute"
            style={{
              left: 180, right: selectedUser ? 280 : 0,
              top: 0, bottom: 56,
              overflow: "hidden",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* 区域标题栏 */}
            <div className="text-center py-2 shrink-0">
              <span className="pixel-font" style={{ fontSize: 12, color: "var(--pixel-gold)" }}>
                🏰 星罗城
              </span>
              <span style={{ fontSize: 10, color: "var(--pixel-muted)", marginLeft: 8 }}>
                {allVisible.length}/{MAX_USERS}
              </span>
              <button
                onClick={() => setMapLayer("cities")}
                style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--pixel-blue)" }}
              >
                🌌 查看所有城市 →
              </button>
            </div>

            {/* 地图网格，填满剩余空间 */}
            <div className="flex-1 p-2" style={{ overflow: "hidden" }}>
              <MapGrid
                users={allVisible}
                currentUser={currentUser}
                selectedUserId={selectedUser?.id ?? null}
                onSelectUser={setSelectedUser}
              />
            </div>
          </div>

          {selectedUser && (
            <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
          )}
        </>
      )}

      {/* === 地图：城市层 === */}
      {menuTab === "map" && mapLayer === "cities" && (
        <>
          <CityMapView
            cities={zones}
            onSelectCity={(city) => {
              if (city.status === "active") {
                setSelectedZone(city);
              } else {
                setShowVoteModal(true);
              }
            }}
            onPropose={() => setShowZoneModal(true)}
          />
          <button
            onClick={() => setMapLayer("area")}
            className="fixed top-3 left-3 z-50 pixel-btn"
            style={{ fontSize: 10 }}
          >
            ← 返回区域
          </button>
        </>
      )}

      {/* === 动态（内嵌发帖） === */}
      {menuTab === "posts" && (
        <PostFeed posts={posts} onReact={handleReact} onPost={handlePost} />
      )}

      {menuTab === "market" && <MarketView currentUserId={currentUser?.id} onBuy={() => fetchAll(currentUser?.id)} />}
      {menuTab === "search" && <UserSearchPanel />}
      {menuTab === "rank" && <LeaderboardView currentUserId={currentUser?.id} />}
      {menuTab === "me" && currentUser && <ProfileView user={currentUser} onUserUpdate={setCurrentUser} />}

      {/* === 底部菜单 === */}
      <GameMenu active={menuTab} onChange={(t) => {
        if (t === "map") { handleMapTabClick(); return; }
        setMenuTab(t);
        setSelectedUser(null);
        setMapLayer("area");
      }} />

      {/* === 弹窗 === */}
      {showZoneModal && <ZoneModal onSubmit={handleProposeZone} onClose={() => setShowZoneModal(false)} />}
      {showVoteModal && <VoteModal zones={votingZones} onVote={handleVote} onClose={() => setShowVoteModal(false)} />}
      {selectedZone && <ZoneDetailModal zone={selectedZone} onClose={() => setSelectedZone(null)} />}
    </div>
  );
}
