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
import FriendsView from "./components/FriendsView";
import ForumView from "./components/ForumView";
import PostFeed from "./components/PostFeed";
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
  const [currentUser, setCurrentUser] = useState<PlazaUser | null>(null);

  const [visibleSeed, setVisibleSeed] = useState(0);
  const [selectedUser, setSelectedUser] = useState<PlazaUser | null>(null);

  // 查看其他营地（闲逛模式）
  const [viewingCampId, setViewingCampId] = useState<string | null>(null);
  const [viewingCampPosts, setViewingCampPosts] = useState<PlazaPostWithReactions[]>([]);

  const [menuTab, setMenuTab] = useState<MenuTab>("forum");
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

  const myCampId = currentUser?.campId ?? "camp_default";
  const otherUsers = users.filter((u) => u.id !== currentUser?.id);
  const shuffled = [...otherUsers].sort(
    (a, b) => hashStr(a.id + visibleSeed) - hashStr(b.id + visibleSeed)
  );
  const visibleOthers = shuffled.slice(0, MAX_USERS - 1);
  const allVisible = currentUser ? [currentUser, ...visibleOthers] : visibleOthers;
  const myCamp = camps.find((c) => c.id === myCampId) ?? camps[0] ?? null;
  const campUsers = myCamp
    ? allVisible.filter((u) => (u.campId ?? "camp_default") === myCampId)
    : allVisible;
  const votingZones = zones.filter((z) => z.status === "voting");

  // ============ 闲逛：查看其他营地 ============

  async function viewCamp(campId: string) {
    setViewingCampId(campId);
    const campPosts = await api.fetchPosts(currentUser?.id, campId);
    setViewingCampPosts(campPosts);
    setMenuTab("camp");
  }

  function exitViewing() {
    setViewingCampId(null);
    setViewingCampPosts([]);
  }

  const isViewing = viewingCampId !== null && viewingCampId !== myCampId;
  const viewingCamp = isViewing ? camps.find((c) => c.id === viewingCampId) : null;
  const viewingUsers = isViewing
    ? users.filter((u) => (u.campId ?? "camp_default") === viewingCampId)
    : [];

  // ============ 回调 ============

  async function handlePost(content: string) {
    if (!currentUser) return;
    const { post } = await api.createPost({
      userId: currentUser.id, userName: currentUser.name,
      userAvatar: currentUser.avatarUrl, campId: myCampId, content,
    });
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

  async function handleFollowCamp(campId: string) {
    if (!currentUser) return;
    await api.followCamp(currentUser.id, campId);
  }

  // ============ 渲染 ============

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--pixel-bg)" }}>

      {/* === 营地 === */}
      {menuTab === "camp" && !isViewing && (
        <>
          <UserSidebar
            users={campUsers.filter((u) => u.id !== currentUser?.id)}
            totalCount={Math.max(0, campUsers.length - (currentUser ? 1 : 0))}
            selectedUserId={selectedUser?.id ?? null}
            onSelectUser={setSelectedUser}
            onRefresh={() => { setVisibleSeed((s) => s + 1); setSelectedUser(null); }}
          />
          <div className="absolute" style={{ left: 180, right: selectedUser ? 280 : 0, top: 0, bottom: 56, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="text-center py-2 shrink-0">
              <span className="pixel-font" style={{ fontSize: 12, color: "var(--pixel-gold)" }}>⛺ {myCamp?.name ?? "营地"}</span>
              <span style={{ fontSize: 10, color: "var(--pixel-muted)", marginLeft: 8 }}>{campUsers.length} 冒险者</span>
              {myCamp?.visibility === "private" && <span style={{ fontSize: 9, color: "var(--pixel-accent)", marginLeft: 6 }}>🔒</span>}
            </div>
            <div className="flex-1 p-1" style={{ overflow: "hidden" }}>
              <MapGrid users={campUsers} currentUser={currentUser} selectedUserId={selectedUser?.id ?? null} onSelectUser={setSelectedUser} />
            </div>
          </div>
          {selectedUser && (
            <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)}
              currentUserId={currentUser?.id} currentUserName={currentUser?.name} />
          )}
        </>
      )}

      {/* === 闲逛其他营地 === */}
      {menuTab === "camp" && isViewing && (
        <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="pixel-font" style={{ fontSize: 12, color: "var(--pixel-gold)" }}>
                  👁️ {viewingCamp?.name ?? "营地"}
                </span>
                <span style={{ fontSize: 10, color: "var(--pixel-muted)", marginLeft: 8 }}>
                  闲逛中 · {viewingUsers.length} 冒险者
                </span>
              </div>
              <div className="flex gap-2">
                <button className="pixel-btn pixel-btn-green" style={{ fontSize: 10 }}
                  onClick={() => handleFollowCamp(viewingCampId!)}>⭐ 关注</button>
                <button className="pixel-btn" style={{ fontSize: 10 }} onClick={exitViewing}>← 返回</button>
              </div>
            </div>

            {/* 营地成员 */}
            <div className="pixel-border p-3 mb-4" style={{ background: "var(--pixel-panel)" }}>
              <div className="mb-2" style={{ fontSize: 12, color: "var(--pixel-gold)" }}>成员 ({viewingUsers.length})</div>
              <div className="flex flex-wrap gap-1">
                {viewingUsers.slice(0, 20).map((u) => (
                  <span key={u.id} style={{ fontSize: 10, color: "var(--pixel-text)", padding: "2px 6px", background: "var(--pixel-bg)" }}>
                    {u.name}
                  </span>
                ))}
                {viewingUsers.length > 20 && <span style={{ fontSize: 10, color: "var(--pixel-muted)" }}>+{viewingUsers.length - 20}</span>}
              </div>
            </div>

            {/* 营地帖子 */}
            <div className="mb-2" style={{ fontSize: 12, color: "var(--pixel-gold)" }}>帖子</div>
            {viewingCampPosts.length === 0 ? (
              <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 12, color: "var(--pixel-muted)" }}>
                该营地暂无帖子
              </div>
            ) : (
              viewingCampPosts.map((post) => (
                <div key={post.id} className="pixel-border p-3 mb-2" style={{ background: "var(--pixel-panel)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontSize: 12 }}>{post.userName}</span>
                    <span style={{ fontSize: 10, color: "var(--pixel-muted)", marginLeft: "auto" }}>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{post.content}</p>
                  <div className="flex gap-2 mt-1" style={{ fontSize: 10, color: "var(--pixel-muted)" }}>
                    <span>👍 {post.likes}</span>
                    <span>👎 {post.dislikes}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* === 世界 === */}
      {menuTab === "world" && (
        <WorldCanvas
          cities={zones}
          currentUserId={currentUser?.id}
          onSelectCity={(city) => {
            if (city.status === "voting") setShowVoteModal(true);
            else setSelectedZone(city);
          }}
          onPropose={() => setShowZoneModal(true)}
          onViewCamp={viewCamp}
        />
      )}

      {/* === 论坛 === */}
      {menuTab === "forum" && currentUser && (
        <ForumView
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserAvatar={currentUser.avatarUrl}
          currentReputation={currentUser.reputation}
          campId={myCampId}
          onReact={handleReact}
        />
      )}

      {/* === 好友 === */}
      {menuTab === "friends" && currentUser && (
        <FriendsView currentUserId={currentUser.id} onSelectUser={setSelectedUser} />
      )}

      {/* === 其他 tab === */}
      {menuTab === "market" && <MarketView currentUserId={currentUser?.id} onBuy={() => fetchAll(currentUser?.id)} />}
      {menuTab === "rank" && <LeaderboardView currentUserId={currentUser?.id} />}
      {menuTab === "me" && currentUser && <ProfileView user={currentUser} onUserUpdate={setCurrentUser} />}

      {/* === 底部菜单 === */}
      <GameMenu active={menuTab} onChange={(t) => { setMenuTab(t); setSelectedUser(null); if (t !== "camp") exitViewing(); }} />

      {/* === 弹窗 === */}
      {showZoneModal && <ZoneModal onSubmit={handleProposeZone} onClose={() => setShowZoneModal(false)} />}
      {showVoteModal && <VoteModal zones={votingZones} onVote={handleVote} onClose={() => setShowVoteModal(false)} />}
      {selectedZone && <ZoneDetailModal zone={selectedZone} onClose={() => setSelectedZone(null)} />}
    </div>
  );
}
