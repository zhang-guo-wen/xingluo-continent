"use client";

import { useState } from "react";
import type { PlazaPostWithReactions, ReactionType } from "@/lib/types";
import { timeAgo, stringToColor } from "@/lib/utils";

interface Props {
  posts: PlazaPostWithReactions[];
  onReact: (postId: string, action: ReactionType) => void;
  onPost?: (content: string) => Promise<void>;
}

export default function PostFeed({ posts, onReact, onPost }: Props) {
  const [sort, setSort] = useState<"new" | "hot">("new");
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);

  const sorted = sort === "hot"
    ? [...posts].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes))
    : posts;

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
      <h2 className="pixel-font text-center mb-2" style={{ fontSize: 14 }}>广场动态</h2>

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
          <div className="flex justify-end">
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
