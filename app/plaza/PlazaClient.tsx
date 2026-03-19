"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { PlazaUser, PlazaPostWithReactions, City, ReactionType } from "@/lib/types";
import { hashStr } from "@/lib/utils";
import * as api from "@/lib/api";
import { TILE, MAP_W, MAP_H, MAX_VISIBLE, GRID_COLS, GRID_ROWS, ZONE_ICONS } from "./constants";

// 组件
import GameMenu, { type MenuTab } from "./components/GameMenu";
import ActionFab from "./components/ActionFab";
import MiniMap from "./components/MiniMap";
import UserSidebar from "./components/UserSidebar";
import UserBlock from "./components/UserBlock";
import NpcBlock from "./components/NpcBlock";
import PostFeed from "./components/PostFeed";
import UserSearchPanel from "./components/UserSearchPanel";
import ProfileView from "./components/ProfileView";
import LeaderboardView from "./components/LeaderboardView";
import MarketView from "./components/MarketView";

// 弹窗
import PostModal from "./components/modals/PostModal";
import ZoneModal from "./components/modals/ZoneModal";
import VoteModal from "./components/modals/VoteModal";
import ZoneDetailModal from "./components/modals/ZoneDetailModal";

// ============ 主组件 ============

export default function PlazaClient() {
  // 数据
  const [users, setUsers] = useState<PlazaUser[]>([]);
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [zones, setZones] = useState<City[]>([]);
  const [currentUser, setCurrentUser] = useState<PlazaUser | null>(null);

  // 地图
  const [offset, setOffset] = useState({ x: -100, y: -50 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [visibleSeed, setVisibleSeed] = useState(0);

  // UI
  const [menuTab, setMenuTab] = useState<MenuTab>("map");
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<City | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);

  // ============ 数据加载 ============

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

  // ============ 计算可见用户 ============

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);
  const shuffled = [...otherUsers].sort(
    (a, b) => hashStr(a.id + visibleSeed) - hashStr(b.id + visibleSeed)
  );
  const visibleOthers = shuffled.slice(0, MAX_VISIBLE);
  const mapUsers = visibleOthers.slice(0, GRID_COLS * GRID_ROWS);
  const votingZones = zones.filter((z) => z.status === "voting");

  // ============ 地图拖拽 ============

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  }

  // ============ 位置计算 ============

  function getGridPos(index: number) {
    const zone = zones.find((z) => z.id === "xingluo") ?? zones[0];
    if (!zone) return { x: 0, y: 0 };
    return {
      x: (zone.gridX + 0.8 + (index % GRID_COLS) * 1.2) * TILE,
      y: (zone.gridY + 1.0 + Math.floor(index / GRID_COLS) * 1.0) * TILE,
    };
  }

  function getSelfPos() {
    const zone = zones.find((z) => z.id === "xingluo") ?? zones[0];
    if (!zone) return { x: 0, y: 0 };
    return {
      x: (zone.gridX + zone.gridW / 2 - 0.5) * TILE,
      y: (zone.gridY + zone.gridH - 1.2) * TILE,
    };
  }

  // ============ 操作回调 ============

  async function handlePost(content: string) {
    if (!currentUser) return;
    await api.createPost({
      userId: currentUser.id, userName: currentUser.name,
      userAvatar: currentUser.avatarUrl, content,
    });
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
          <div
            className="absolute inset-0 map-grid scanlines"
            style={{ cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragging(false)}
          >
            <div
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                width: MAP_W * TILE, height: MAP_H * TILE,
                position: "relative",
              }}
            >
              {/* 区域 */}
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`zone-block ${zone.status === "voting" ? "voting" : ""}`}
                  style={{
                    left: zone.gridX * TILE, top: zone.gridY * TILE,
                    width: zone.gridW * TILE, height: zone.gridH * TILE,
                    background: zone.color + "40",
                  }}
                  onClick={() => { if (!dragging) setSelectedZone(zone); }}
                >
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    <span style={{ fontSize: 28 }}>{ZONE_ICONS[zone.icon] ?? "🏠"}</span>
                    <span className="pixel-font" style={{ fontSize: 11, color: "#fff", textShadow: "1px 1px 0 #000" }}>{zone.name}</span>
                    {zone.status === "voting" && (
                      <span style={{ fontSize: 10, color: "var(--pixel-gold)" }}>投票中 {zone.voteCount}/{zone.voteThreshold}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* NPC */}
              <NpcBlock onInteract={() => setShowZoneModal(true)} />

              {/* 其他用户 4x4 */}
              {mapUsers.map((user, i) => {
                const pos = getGridPos(i);
                return (
                  <UserBlock key={user.id} user={user} x={pos.x} y={pos.y}
                    hovered={hoveredUser === user.id} onHover={setHoveredUser} />
                );
              })}

              {/* 自己 */}
              {currentUser && (() => {
                const pos = getSelfPos();
                return (
                  <UserBlock user={currentUser} x={pos.x} y={pos.y}
                    hovered={hoveredUser === currentUser.id} highlight onHover={setHoveredUser} />
                );
              })()}
            </div>
          </div>

          <UserSidebar
            users={visibleOthers}
            totalCount={otherUsers.length}
            hoveredUser={hoveredUser}
            onHover={setHoveredUser}
            onRefresh={() => setVisibleSeed((s) => s + 1)}
          />
          <MiniMap zones={zones} />
        </>
      )}

      {/* === 动态 === */}
      {menuTab === "posts" && <PostFeed posts={posts} onReact={handleReact} />}

      {/* === 市场 === */}
      {menuTab === "market" && <MarketView currentUserId={currentUser?.id} onBuy={() => fetchAll(currentUser?.id)} />}

      {/* === 搜索 === */}
      {menuTab === "search" && <UserSearchPanel />}

      {/* === 排行 === */}
      {menuTab === "rank" && <LeaderboardView currentUserId={currentUser?.id} />}

      {/* === 个人 === */}
      {menuTab === "me" && currentUser && <ProfileView user={currentUser} onUserUpdate={setCurrentUser} />}

      {/* === 底部菜单 === */}
      <GameMenu active={menuTab} onChange={setMenuTab} />

      {/* === FAB === */}
      <ActionFab votingCount={votingZones.length} onPost={() => setShowPostModal(true)} onVote={() => setShowVoteModal(true)} />

      {/* === 弹窗 === */}
      {showPostModal && <PostModal onSubmit={handlePost} onClose={() => setShowPostModal(false)} />}
      {showZoneModal && <ZoneModal onSubmit={handleProposeZone} onClose={() => setShowZoneModal(false)} />}
      {showVoteModal && <VoteModal zones={votingZones} onVote={handleVote} onClose={() => setShowVoteModal(false)} />}
      {selectedZone && <ZoneDetailModal zone={selectedZone} onClose={() => setSelectedZone(null)} />}
    </div>
  );
}
