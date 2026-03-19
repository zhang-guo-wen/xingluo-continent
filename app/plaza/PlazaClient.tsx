"use client";

import { useEffect, useState, useCallback } from "react";
import type { PlazaUser, PlazaPostWithReactions, City, Camp, ReactionType } from "@/lib/types";
import { hashStr } from "@/lib/utils";
import * as api from "@/lib/api";
import { MAX_USERS } from "./constants";
import { gunPublishPost } from "@/lib/gun";

import GameMenu, { type MenuTab } from "./components/GameMenu";
import MapGrid from "./components/MapGrid";
import WorldCanvas from "./components/WorldCanvas";
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
  const [camps, setCamps] = useState<Camp[]>([]);
  const [currentCamp, setCurrentCamp] = useState<Camp | null>(null);
  const [currentUser, setCurrentUser] = useState<PlazaUser | null>(null);

  const [visibleSeed, setVisibleSeed] = useState(0);
  const [selectedUser, setSelectedUser] = useState<PlazaUser | null>(null);

  const [menuTab, setMenuTab] = useState<MenuTab>("camp");
  const [selectedZone, setSelectedZone] = useState<City | null>(null);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);

  // ============ 数据 ============

  const fetchAll = useCallback(async (userId?: string) => {
    const [u, p, z, c] = await Promise.all([
      api.fetchPlazaUsers(),
      api.fetchPosts(userId),
      api.fetchZones(),
      api.fetchCamps(),
    ]);
    setUsers(u);
    setPosts(p);
    setZones(z);
    setCamps(c);
    // 用数据库中的真实用户数据更新 currentUser
    if (userId) {
      const dbUser = u.find((x) => x.id === userId);
      if (dbUser) setCurrentUser(dbUser);
    }
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
        campId: null, isOnline: true, lastSeenAt: null,
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

  // 当前用户的营地（campId 为 null 视为默认营地）
  const myCampId = currentUser?.campId ?? "camp_default";
  const myCamp = camps.find((c) => c.id === myCampId) ?? camps[0] ?? null;
  // 只显示同营地的用户；无营地数据时显示所有人
  const campUsers = myCamp
    ? allVisible.filter((u) => (u.campId ?? "camp_default") === myCampId)
    : allVisible;
  const votingZones = zones.filter((z) => z.status === "voting");

  // ============ 回调 ============

  async function handlePost(content: string) {
    if (!currentUser) return;
    const { post } = await api.createPost({ userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatarUrl, content });
    // 同时广播到 Gun P2P 网络（营地频道 + 城市频道）
    gunPublishPost({
      id: post.id, userId: post.userId, userName: post.userName,
      userAvatar: post.userAvatar, campId: myCampId,
      content: post.content, createdAt: post.createdAt,
    });
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

      {/* === 营地：冒险者区域 === */}
      {menuTab === "camp" && (
        <>
          <UserSidebar
            users={campUsers.filter((u) => u.id !== currentUser?.id)}
            totalCount={Math.max(0, campUsers.length - (currentUser ? 1 : 0))}
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
            <div className="text-center py-2 shrink-0">
              <span className="pixel-font" style={{ fontSize: 12, color: "var(--pixel-gold)" }}>
                ⛺ {myCamp?.name ?? "营地"}
              </span>
              <span style={{ fontSize: 10, color: "var(--pixel-muted)", marginLeft: 8 }}>
                {campUsers.length} 冒险者
              </span>
              {myCamp?.visibility === "private" && (
                <span style={{ fontSize: 9, color: "var(--pixel-accent)", marginLeft: 6 }}>🔒 私人</span>
              )}
            </div>
            <div className="flex-1 p-1" style={{ overflow: "hidden" }}>
              <MapGrid
                users={campUsers}
                currentUser={currentUser}
                selectedUserId={selectedUser?.id ?? null}
                onSelectUser={setSelectedUser}
              />
            </div>
          </div>

          {selectedUser && (
            <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)}
              currentUserId={currentUser?.id} currentUserName={currentUser?.name} />
          )}
        </>
      )}

      {/* === 世界：城市画布 === */}
      {menuTab === "world" && (
        <WorldCanvas
          cities={zones}
          onSelectCity={(city) => {
            if (city.status === "voting") setShowVoteModal(true);
            else setSelectedZone(city);
          }}
          onPropose={() => setShowZoneModal(true)}
        />
      )}

      {/* === 其他 tab === */}
      {menuTab === "posts" && (
        <PostFeed posts={posts} onReact={handleReact} onPost={handlePost}
          campId={myCampId} />
      )}
      {menuTab === "market" && <MarketView currentUserId={currentUser?.id} onBuy={() => fetchAll(currentUser?.id)} />}
      {menuTab === "search" && <UserSearchPanel />}
      {menuTab === "rank" && <LeaderboardView currentUserId={currentUser?.id} />}
      {menuTab === "me" && currentUser && <ProfileView user={currentUser} onUserUpdate={setCurrentUser} />}

      {/* === 底部菜单 === */}
      <GameMenu active={menuTab} onChange={(t) => { setMenuTab(t); setSelectedUser(null); }} />

      {/* === 弹窗 === */}
      {showZoneModal && <ZoneModal onSubmit={handleProposeZone} onClose={() => setShowZoneModal(false)} />}
      {showVoteModal && <VoteModal zones={votingZones} onVote={handleVote} onClose={() => setShowVoteModal(false)} />}
      {selectedZone && <ZoneDetailModal zone={selectedZone} onClose={() => setSelectedZone(null)} />}
    </div>
  );
}
