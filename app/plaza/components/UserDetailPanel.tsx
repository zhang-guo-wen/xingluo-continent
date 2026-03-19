"use client";

import { useEffect, useState } from "react";
import type { PlazaUser, UserSkill, PlazaPostWithReactions, UserEvent, UserItem, UserTask } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import * as api from "@/lib/api";
import PixelAvatar from "./PixelAvatar";

type DetailTab = "events" | "skills" | "posts" | "items" | "tasks";

const TABS: { key: DetailTab; icon: string; label: string }[] = [
  { key: "events", icon: "📜", label: "事件" },
  { key: "skills", icon: "🎯", label: "技能" },
  { key: "posts", icon: "📝", label: "消息" },
  { key: "items", icon: "🏪", label: "商品" },
  { key: "tasks", icon: "📋", label: "任务" },
];

interface Props {
  user: PlazaUser;
  onClose: () => void;
  currentUserId?: string;
  currentUserName?: string;
}

export default function UserDetailPanel({ user, onClose, currentUserId }: Props) {
  const [tab, setTab] = useState<DetailTab>("events");
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [items, setItems] = useState<UserItem[]>([]);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [isFriend, setIsFriend] = useState(false);

  useEffect(() => {
    api.fetchSkills(user.id).then(setSkills).catch(() => {});
    api.fetchPosts(user.id).then((all) => setPosts(all.filter((p) => p.userId === user.id).slice(0, 10))).catch(() => {});
    api.fetchUserEvents(user.id, 15).then(setEvents).catch(() => {});
    api.fetchUserItems(user.id).then(setItems).catch(() => {});
    api.fetchUserTasks(user.id).then(setTasks).catch(() => {});
    if (currentUserId) {
      api.fetchFriends(currentUserId).then((friends) => {
        setIsFriend(friends.some((f) => f.friendId === user.id));
      }).catch(() => {});
    }
  }, [user.id, currentUserId]);

  async function toggleFriend() {
    if (!currentUserId) return;
    if (isFriend) { await api.removeFriend(currentUserId, user.id); setIsFriend(false); }
    else { await api.addFriend(currentUserId, user.id); setIsFriend(true); }
  }

  return (
    <div className="fixed top-0 right-0 z-40 h-full overflow-y-auto"
      style={{ width: 300, background: "var(--pixel-panel)", borderLeft: "2px solid var(--pixel-border)", paddingBottom: 60 }}>

      <button onClick={onClose}
        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "var(--pixel-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>

      <div className="p-4">
        {/* 头像 + 基本信息 */}
        <div className="text-center mb-3">
          <div className="flex justify-center mb-2"><PixelAvatar name={user.name} avatarUrl={user.avatarUrl} size={48} /></div>
          <div className="pixel-font" style={{ fontSize: 12 }}>{user.name}</div>
          <div style={{ fontSize: 10, color: "var(--pixel-muted)", marginTop: 2 }}>{user.userNo}</div>
          {user.occupation && <div style={{ fontSize: 11, color: "var(--pixel-gold)", marginTop: 2 }}>{user.occupation}</div>}
        </div>

        {user.description && (
          <div className="pixel-border p-2 mb-3" style={{ background: "var(--pixel-bg)", fontSize: 11, color: "var(--pixel-muted)", lineHeight: 1.5 }}>
            {user.description}
          </div>
        )}

        {/* 数值 */}
        <div className="flex justify-around mb-3" style={{ fontSize: 11 }}>
          <div className="text-center"><div style={{ color: "var(--pixel-gold)" }}>⭐{user.reputation}</div><div style={{ fontSize: 8, color: "var(--pixel-muted)" }}>信誉</div></div>
          <div className="text-center"><div style={{ color: "var(--pixel-gold)" }}>🪙{user.coins}</div><div style={{ fontSize: 8, color: "var(--pixel-muted)" }}>金币</div></div>
          <div className="text-center"><div style={{ color: "var(--pixel-blue)" }}>⚡{user.compute ?? 0}</div><div style={{ fontSize: 8, color: "var(--pixel-muted)" }}>算力</div></div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mb-3 justify-center">
          {currentUserId && currentUserId !== user.id && (
            <button className={`pixel-btn ${isFriend ? "" : "pixel-btn-green"}`} style={{ fontSize: 9 }} onClick={toggleFriend}>
              {isFriend ? "❌ 取消好友" : "👫 加好友"}
            </button>
          )}
          {user.route && (
            <a href={`https://second-me.cn/${user.route}`} target="_blank" rel="noopener noreferrer"
              className="pixel-btn" style={{ fontSize: 9 }}>🔗 主页</a>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-px mb-3" style={{ background: "rgba(15,52,96,0.5)" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 py-1 text-center"
              style={{ fontSize: 8, border: "none", cursor: "pointer",
                background: tab === t.key ? "var(--pixel-panel)" : "transparent",
                color: tab === t.key ? "var(--pixel-gold)" : "var(--pixel-muted)" }}>
              {t.icon}
            </button>
          ))}
        </div>

        {/* 事件 */}
        {tab === "events" && events.map((evt) => (
          <div key={evt.id} className="pixel-border p-2 mb-1" style={{ background: "var(--pixel-bg)" }}>
            <div style={{ fontSize: 10 }}>{evt.detail}</div>
            <div className="flex gap-2 mt-1" style={{ fontSize: 8, color: "var(--pixel-muted)" }}>
              <span>👍{evt.likes} 👎{evt.dislikes}</span>
              <span style={{ marginLeft: "auto" }}>{timeAgo(evt.createdAt)}</span>
            </div>
          </div>
        ))}

        {/* 技能 */}
        {tab === "skills" && (skills.length === 0
          ? <div style={{ fontSize: 10, color: "var(--pixel-muted)", textAlign: "center" }}>无技能</div>
          : <div className="flex flex-wrap gap-1">{skills.map((s) => (
            <span key={s.id} className="pixel-border px-2 py-1" style={{ fontSize: 10, background: "var(--pixel-bg)" }}>🎯 {s.name}</span>
          ))}</div>)}

        {/* 消息 */}
        {tab === "posts" && posts.map((p) => (
          <div key={p.id} className="pixel-border p-2 mb-1" style={{ background: "var(--pixel-bg)" }}>
            <div style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{p.content.slice(0, 100)}{p.content.length > 100 ? "..." : ""}</div>
            <div className="flex gap-2 mt-1" style={{ fontSize: 8, color: "var(--pixel-muted)" }}>
              <span>👍{p.likes} 👎{p.dislikes}</span>
              <span style={{ marginLeft: "auto" }}>{timeAgo(p.createdAt)}</span>
            </div>
          </div>
        ))}

        {/* 商品 */}
        {tab === "items" && (items.length === 0
          ? <div style={{ fontSize: 10, color: "var(--pixel-muted)", textAlign: "center" }}>无商品</div>
          : items.map((item) => (
            <div key={item.id} className="pixel-border p-2 mb-1 flex justify-between" style={{ background: "var(--pixel-bg)" }}>
              <div><div style={{ fontSize: 10 }}>{item.name}</div><div style={{ fontSize: 8, color: "var(--pixel-muted)" }}>{item.status}</div></div>
              <div style={{ fontSize: 11, color: "var(--pixel-gold)" }}>🪙{item.price}</div>
            </div>
          )))}

        {/* 任务 */}
        {tab === "tasks" && (tasks.length === 0
          ? <div style={{ fontSize: 10, color: "var(--pixel-muted)", textAlign: "center" }}>无任务</div>
          : tasks.map((task) => (
            <div key={task.id} className="pixel-border p-2 mb-1 flex justify-between" style={{ background: "var(--pixel-bg)" }}>
              <div><div style={{ fontSize: 10 }}>{task.title}</div><div style={{ fontSize: 8, color: "var(--pixel-muted)" }}>{task.status}</div></div>
              <div style={{ fontSize: 11, color: "var(--pixel-gold)" }}>🪙{task.reward}</div>
            </div>
          )))}
      </div>
    </div>
  );
}
