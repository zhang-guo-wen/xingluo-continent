"use client";

import type { PlazaPostWithReactions, ReactionType } from "@/lib/types";
import { timeAgo, stringToColor } from "@/lib/utils";

interface Props {
  posts: PlazaPostWithReactions[];
  onReact: (postId: string, action: ReactionType) => void;
}

export default function PostFeed({ posts, onReact }: Props) {
  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-4" style={{ fontSize: 14 }}>广场动态</h2>
      <div className="max-w-lg mx-auto space-y-3">
        {posts.length === 0 ? (
          <p className="text-center" style={{ color: "var(--pixel-muted)" }}>还没有动态</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="pixel-border p-3" style={{ background: "var(--pixel-panel)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 flex items-center justify-center text-xs"
                  style={{ background: post.userAvatar ? "transparent" : stringToColor(post.userName), border: "1px solid var(--pixel-border)" }}
                >
                  {post.userAvatar
                    ? <img src={post.userAvatar} alt="" className="pixel-avatar w-full h-full object-cover" />
                    : post.userName[0]}
                </div>
                <span style={{ fontSize: 14 }}>{post.userName}</span>
                <span style={{ fontSize: 12, color: "var(--pixel-muted)", marginLeft: "auto" }}>{timeAgo(post.createdAt)}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.content}</p>
              <div className="flex gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--pixel-border)" }}>
                <button
                  onClick={() => onReact(post.id, "like")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: post.userReaction === "like" ? "var(--pixel-blue)" : "var(--pixel-muted)" }}
                >
                  👍 {post.likes || ""}
                </button>
                <button
                  onClick={() => onReact(post.id, "dislike")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: post.userReaction === "dislike" ? "var(--pixel-accent)" : "var(--pixel-muted)" }}
                >
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
