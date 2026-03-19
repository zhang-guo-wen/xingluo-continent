"use client";

import { useEffect, useState } from "react";
import type { PlazaUser, UserSkill, PlazaPostWithReactions, UserEvent } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import * as api from "@/lib/api";
import PixelAvatar from "./PixelAvatar";

interface Props {
  user: PlazaUser;
  currentUserId?: string;
  currentUserName?: string;
  onClose: () => void;
}

export default function UserDetailPanel({ user, onClose, currentUserId, currentUserName }: Props) {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);

  useEffect(() => {
    api.fetchSkills(user.id).then(setSkills).catch(() => {});
    api.fetchPosts(user.id).then((all) => setPosts(all.filter((p) => p.userId === user.id).slice(0, 5))).catch(() => {});
    api.fetchUserEvents(user.id, 10).then(setEvents).catch(() => {});
  }, [user.id]);

  return (
    <div
      className="fixed top-0 right-0 z-40 h-full overflow-y-auto"
      style={{
        width: 280, background: "var(--pixel-panel)",
        borderLeft: "2px solid var(--pixel-border)",
        paddingBottom: 60,
      }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "none", border: "none", color: "var(--pixel-muted)",
          cursor: "pointer", fontSize: 18,
        }}
      >✕</button>

      <div className="p-4">
        {/* 头像 + 基本信息 */}
        <div className="text-center mb-4">
          <div className="flex justify-center mb-2">
            <PixelAvatar name={user.name} avatarUrl={user.avatarUrl} size={56} />
          </div>
          <div className="pixel-font" style={{ fontSize: 12, color: "var(--pixel-text)" }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "var(--pixel-muted)", marginTop: 2 }}>{user.userNo}</div>
          {user.occupation && <div style={{ fontSize: 12, color: "var(--pixel-gold)", marginTop: 4 }}>{user.occupation}</div>}
        </div>

        {/* 描述 */}
        {user.description && (
          <div className="pixel-border p-2 mb-3" style={{ background: "var(--pixel-bg)", fontSize: 12, color: "var(--pixel-muted)", lineHeight: 1.6 }}>
            {user.description}
          </div>
        )}

        {/* 数据 */}
        <div className="flex justify-around mb-4" style={{ fontSize: 12 }}>
          <div className="text-center">
            <div style={{ color: "var(--pixel-gold)" }}>⭐ {user.reputation}</div>
            <div style={{ fontSize: 9, color: "var(--pixel-muted)" }}>信誉</div>
          </div>
          <div className="text-center">
            <div style={{ color: "var(--pixel-gold)" }}>🪙 {user.coins}</div>
            <div style={{ fontSize: 9, color: "var(--pixel-muted)" }}>金币</div>
          </div>
          <div className="text-center">
            <div style={{ color: "var(--pixel-blue)" }}>⚡ {user.compute ?? 0}</div>
            <div style={{ fontSize: 9, color: "var(--pixel-muted)" }}>算力</div>
          </div>
        </div>

        {/* 主页链接 */}
        {user.route && (
          <a
            href={`https://second-me.cn/${user.route}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-btn block text-center mb-4"
            style={{ fontSize: 10 }}
          >
            🔗 SecondMe 主页
          </a>
        )}

        {/* 技能 */}
        {skills.length > 0 && (
          <div className="mb-4">
            <div className="pixel-font mb-2" style={{ fontSize: 9, color: "var(--pixel-gold)" }}>技能</div>
            <div className="flex flex-wrap gap-1">
              {skills.map((s) => (
                <span key={s.id} className="pixel-border px-2 py-1" style={{ fontSize: 10, background: "var(--pixel-bg)", color: "var(--pixel-text)" }}>
                  🎯 {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 最近消息 */}
        {posts.length > 0 && (
          <div>
            <div className="pixel-font mb-2" style={{ fontSize: 9, color: "var(--pixel-gold)" }}>最近消息</div>
            {posts.map((p) => (
              <div key={p.id} className="pixel-border p-2 mb-1" style={{ background: "var(--pixel-bg)" }}>
                <div style={{ fontSize: 11, color: "var(--pixel-text)", whiteSpace: "pre-wrap" }}>{p.content.slice(0, 80)}{p.content.length > 80 ? "..." : ""}</div>
                <div className="flex gap-2 mt-1" style={{ fontSize: 9, color: "var(--pixel-muted)" }}>
                  <span>👍 {p.likes}</span>
                  <span>👎 {p.dislikes}</span>
                  <span style={{ marginLeft: "auto" }}>{timeAgo(p.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* 最近事件 */}
        {events.length > 0 && (
          <div className="mt-4">
            <div className="pixel-font mb-2" style={{ fontSize: 9, color: "var(--pixel-gold)" }}>最近事件</div>
            {events.map((evt) => (
              <div key={evt.id} className="pixel-border p-2 mb-1" style={{ background: "var(--pixel-bg)" }}>
                <div style={{ fontSize: 10, color: "var(--pixel-text)" }}>{evt.detail}</div>
                <div className="flex gap-2 mt-1" style={{ fontSize: 8, color: "var(--pixel-muted)" }}>
                  <span>🔗 {evt.hash.slice(0, 8)}...</span>
                  <span>👍{evt.likes} 👎{evt.dislikes}</span>
                  <span style={{ marginLeft: "auto" }}>{timeAgo(evt.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
