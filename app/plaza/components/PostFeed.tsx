"use client";

import { useState, useEffect, useRef } from "react";
import type { PlazaPostWithReactions, ReactionType } from "@/lib/types";
import { timeAgo, stringToColor } from "@/lib/utils";
import { gunSubscribePosts, type GunPost } from "@/lib/gun";

interface Props {
  posts: PlazaPostWithReactions[];
  onReact: (postId: string, action: ReactionType) => void;
  onPost?: (content: string) => Promise<void>;
  campId?: string;
}

export default function PostFeed({ posts, onReact, onPost, campId }: Props) {
  const [sort, setSort] = useState<"new" | "hot">("new");
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [gunPosts, setGunPosts] = useState<Map<string, GunPost>>(new Map());
  const [p2pStatus, setP2pStatus] = useState<"connecting" | "connected">("connecting");

  // Gun.js P2P 订阅（按营地+城市隔离）
  useEffect(() => {
    const cId = campId ?? "camp_default";
    const unsub = gunSubscribePosts(cId, (post) => {
      setP2pStatus("connected");
      setGunPosts((prev) => {
        const next = new Map(prev);
        next.set(post.id, post);
        return next;
      });
    });
    // 连接后标记
    const timer = setTimeout(() => setP2pStatus("connected"), 3000);
    return () => { unsub(); clearTimeout(timer); };
  }, [campId]);

  // 合并 Postgres 帖子 + Gun P2P 帖子（去重）
  const mergedPosts = (() => {
    const byId = new Map<string, PlazaPostWithReactions>();
    // Postgres 帖子为主
    for (const p of posts) byId.set(p.id, p);
    // Gun 帖子补充（如果 Postgres 还没同步到）
    for (const [id, gp] of gunPosts) {
      if (!byId.has(id)) {
        byId.set(id, {
          ...gp,
          userAvatar: gp.userAvatar,
          tag: null,
          images: [],
          likes: 0, dislikes: 0, userReaction: null,
        });
      }
    }
    return Array.from(byId.values());
  })();

  const sorted = sort === "hot"
    ? [...mergedPosts].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes))
    : [...mergedPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function handlePost() {
    if (!newContent.trim() || !onPost) return;
    setPosting(true);
    try {
      await onPost(newContent);
      setNewContent("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <div className="flex items-center justify-center gap-3 mb-2">
        <h2 className="pixel-font" style={{ fontSize: 14 }}>广场动态</h2>
        <span style={{
          fontSize: 9, padding: "2px 6px",
          background: p2pStatus === "connected" ? "var(--pixel-green)" : "var(--pixel-border)",
          color: "#fff",
        }}>
          {p2pStatus === "connected" ? "P2P 已连接" : "P2P 连接中..."}
        </span>
      </div>

      {/* 发帖区 */}
      {onPost && (
        <div className="pixel-border p-3 mb-4 max-w-lg mx-auto" style={{ background: "var(--pixel-panel)" }}>
          <textarea
            className="pixel-textarea mb-2"
            rows={2}
            placeholder="说点什么..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 9, color: "var(--pixel-muted)" }}>
              营地内 + 同城广播
            </span>
            <button
              className="pixel-btn pixel-btn-accent"
              style={{ fontSize: 11 }}
              onClick={handlePost}
              disabled={posting || !newContent.trim()}
            >
              {posting ? "发布中..." : "📝 发布"}
            </button>
          </div>
        </div>
      )}

      {/* 排序 */}
      <div className="flex gap-1 mb-4 p-1 max-w-lg mx-auto" style={{ background: "rgba(15,52,96,0.5)" }}>
        <button onClick={() => setSort("new")} className="flex-1 py-1.5 text-center"
          style={{ fontSize: 11, border: "none", cursor: "pointer",
            background: sort === "new" ? "var(--pixel-panel)" : "transparent",
            color: sort === "new" ? "var(--pixel-gold)" : "var(--pixel-muted)" }}>
          🕐 最新
        </button>
        <button onClick={() => setSort("hot")} className="flex-1 py-1.5 text-center"
          style={{ fontSize: 11, border: "none", cursor: "pointer",
            background: sort === "hot" ? "var(--pixel-panel)" : "transparent",
            color: sort === "hot" ? "var(--pixel-gold)" : "var(--pixel-muted)" }}>
          🔥 热门
        </button>
      </div>

      <div className="max-w-lg mx-auto space-y-3">
        {sorted.length === 0 ? (
          <p className="text-center" style={{ color: "var(--pixel-muted)" }}>还没有动态</p>
        ) : (
          sorted.map((post) => (
            <div key={post.id} className="pixel-border p-3" style={{ background: "var(--pixel-panel)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 flex items-center justify-center text-xs"
                  style={{ background: post.userAvatar ? "transparent" : stringToColor(post.userName), border: "1px solid var(--pixel-border)" }}>
                  {post.userAvatar
                    ? <img src={post.userAvatar} alt="" className="pixel-avatar w-full h-full object-cover" />
                    : post.userName[0]}
                </div>
                <span style={{ fontSize: 14 }}>{post.userName}</span>
                <span style={{ fontSize: 12, color: "var(--pixel-muted)", marginLeft: "auto" }}>{timeAgo(post.createdAt)}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.content}</p>
              <div className="flex gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--pixel-border)" }}>
                <button onClick={() => onReact(post.id, "like")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: post.userReaction === "like" ? "var(--pixel-blue)" : "var(--pixel-muted)" }}>
                  👍 {post.likes || ""}
                </button>
                <button onClick={() => onReact(post.id, "dislike")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: post.userReaction === "dislike" ? "var(--pixel-accent)" : "var(--pixel-muted)" }}>
                  👎 {post.dislikes || ""}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
