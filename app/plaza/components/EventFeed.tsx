"use client";

import { useEffect, useState } from "react";
import type { UserEvent, EventComment } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import * as api from "@/lib/api";

const ACTION_LABEL: Record<string, string> = {
  register: "🎉 注册", update_name: "✏️ 改名", update_occupation: "✏️ 改职业",
  update_description: "✏️ 改描述", update_wallet: "💳 改钱包",
  add_skill: "🎯 加技能", remove_skill: "🎯 删技能",
  create_post: "📝 发帖", like_post: "👍 点赞", unlike_post: "👍 取消赞",
  dislike_post: "👎 点踩", undislike_post: "👎 取消踩",
  list_item: "🏪 上架", buy_item: "🛒 购买", remove_item: "🏪 下架",
  create_task: "📋 发任务", complete_task: "✅ 完成任务", cancel_task: "❌ 取消任务",
  checkin: "📅 签到", boost: "⚡ 加速", propose_city: "🏗️ 建城", vote_city: "🗳️ 投票",
};

interface Props {
  userId?: string;
  currentUserId?: string;
  currentUserName?: string;
}

export default function EventFeed({ userId, currentUserId, currentUserName }: Props) {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, EventComment[]>>({});
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (userId) api.fetchUserEvents(userId).then(setEvents).catch(() => {});
    else api.fetchAllEvents().then(setEvents).catch(() => {});
  }, [userId]);

  async function handleVote(eventId: string, vote: "like" | "dislike") {
    if (!currentUserId) return;
    const result = await api.voteEvent(eventId, currentUserId, vote);
    setEvents((prev) =>
      prev.map((e) => e.id === eventId ? { ...e, likes: result.likes, dislikes: result.dislikes } : e)
    );
  }

  async function handleExpand(eventId: string) {
    if (expandedId === eventId) { setExpandedId(null); return; }
    setExpandedId(eventId);
    if (!comments[eventId]) {
      const c = await api.fetchEventComments(eventId);
      setComments((prev) => ({ ...prev, [eventId]: c }));
    }
  }

  async function handleComment(eventId: string) {
    if (!currentUserId || !newComment.trim()) return;
    const c = await api.addEventComment(eventId, currentUserId, currentUserName ?? "用户", newComment.trim());
    setComments((prev) => ({ ...prev, [eventId]: [...(prev[eventId] ?? []), c] }));
    setNewComment("");
  }

  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <div className="pixel-border p-4 text-center" style={{ background: "var(--pixel-panel)", fontSize: 13, color: "var(--pixel-muted)" }}>
          暂无事件记录
        </div>
      ) : (
        events.map((evt) => (
          <div key={evt.id} className="pixel-border p-3" style={{ background: "var(--pixel-panel)" }}>
            {/* 事件头 */}
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontSize: 12, color: "var(--pixel-gold)" }}>{evt.userName}</span>
                  <span style={{ fontSize: 11 }}>{ACTION_LABEL[evt.action] ?? evt.action}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--pixel-muted)", marginTop: 2 }}>{evt.detail}</div>
                <div className="flex items-center gap-1 mt-1" style={{ fontSize: 8, color: "var(--pixel-muted)" }}>
                  🔗 {evt.hash.slice(0, 12)}...
                  <span style={{ marginLeft: "auto" }}>{timeAgo(evt.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* 操作栏 */}
            <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--pixel-border)" }}>
              <button
                onClick={() => handleVote(evt.id, "like")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--pixel-muted)" }}
              >👍 {evt.likes || ""}</button>
              <button
                onClick={() => handleVote(evt.id, "dislike")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--pixel-muted)" }}
              >👎 {evt.dislikes || ""}</button>
              <button
                onClick={() => handleExpand(evt.id)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--pixel-blue)", marginLeft: "auto" }}
              >💬 {expandedId === evt.id ? "收起" : "评论"}</button>
            </div>

            {/* 评论区 */}
            {expandedId === evt.id && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--pixel-border)" }}>
                {(comments[evt.id] ?? []).map((c) => (
                  <div key={c.id} className="mb-1 pl-2" style={{ borderLeft: "2px solid var(--pixel-border)" }}>
                    <span style={{ fontSize: 10, color: "var(--pixel-gold)" }}>{c.userName}</span>
                    <span style={{ fontSize: 11, color: "var(--pixel-text)", marginLeft: 6 }}>{c.content}</span>
                    <span style={{ fontSize: 9, color: "var(--pixel-muted)", marginLeft: 6 }}>{timeAgo(c.createdAt)}</span>
                  </div>
                ))}
                <div className="flex gap-1 mt-2">
                  <input
                    className="pixel-input flex-1"
                    style={{ fontSize: 11, padding: "4px 6px" }}
                    placeholder="写评论..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleComment(evt.id)}
                  />
                  <button
                    className="pixel-btn pixel-btn-accent"
                    style={{ fontSize: 10, padding: "4px 8px" }}
                    onClick={() => handleComment(evt.id)}
                  >发送</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
