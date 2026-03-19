"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { PlazaPostWithReactions, ReactionType } from "@/lib/types";
import { timeAgo, stringToColor } from "@/lib/utils";
import * as api from "@/lib/api";

interface Props {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  campId: string;
  onReact: (postId: string, action: ReactionType) => void;
}

export default function ForumView({ currentUserId, currentUserName, currentUserAvatar, campId, onReact }: Props) {
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.fetchForumPosts(currentUserId).then(setPosts).catch(() => {});
  }, [currentUserId]);

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      await api.createPost({
        userId: currentUserId, userName: currentUserName,
        userAvatar: currentUserAvatar, campId, content,
      });
      setContent("");
      const updated = await api.fetchForumPosts(currentUserId);
      setPosts(updated);
    } finally {
      setPosting(false);
    }
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setUploading(true);
        try {
          const url = await api.uploadImage(currentUserId, file);
          // 插入 Markdown 图片语法
          const img = `![图片](${url})\n`;
          const ta = textareaRef.current;
          if (ta) {
            const start = ta.selectionStart;
            setContent((prev) => prev.slice(0, start) + img + prev.slice(start));
          } else {
            setContent((prev) => prev + img);
          }
        } catch {
          alert("图片上传失败");
        } finally {
          setUploading(false);
        }
      }
    }
  }

  function handleLocalReact(postId: string, action: ReactionType) {
    onReact(postId, action);
    // 乐观更新
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const wasLiked = p.userReaction === "like";
        const wasDisliked = p.userReaction === "dislike";
        if (action === "like") {
          return {
            ...p,
            likes: wasLiked ? p.likes - 1 : p.likes + 1,
            dislikes: wasDisliked ? p.dislikes - 1 : p.dislikes,
            userReaction: wasLiked ? null : "like",
          };
        } else {
          return {
            ...p,
            dislikes: wasDisliked ? p.dislikes - 1 : p.dislikes + 1,
            likes: wasLiked ? p.likes - 1 : p.likes,
            userReaction: wasDisliked ? null : "dislike",
          };
        }
      })
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-4" style={{ fontSize: 14 }}>论坛</h2>
      <div className="text-center mb-3" style={{ fontSize: 10, color: "var(--pixel-muted)" }}>
        关注营地 + 好友的帖子
      </div>

      {/* 发帖区 */}
      <div className="pixel-border p-3 mb-4 max-w-2xl mx-auto" style={{ background: "var(--pixel-panel)" }}>
        <textarea
          ref={textareaRef}
          className="pixel-textarea mb-2"
          rows={3}
          placeholder="支持 Markdown 格式，粘贴图片自动上传..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
        />
        <div className="flex justify-between items-center">
          <span style={{ fontSize: 9, color: "var(--pixel-muted)" }}>
            {uploading ? "📤 图片上传中..." : "支持 **粗体** *斜体* `代码` [链接]() ![图片]()"}
          </span>
          <button
            className="pixel-btn pixel-btn-accent"
            style={{ fontSize: 11 }}
            onClick={handlePost}
            disabled={posting || !content.trim()}
          >
            {posting ? "发布中..." : "📝 发布"}
          </button>
        </div>
      </div>

      {/* 帖子列表 */}
      <div className="max-w-2xl mx-auto space-y-3">
        {posts.length === 0 ? (
          <div className="text-center" style={{ color: "var(--pixel-muted)", fontSize: 13, padding: 20 }}>
            关注一些营地或添加好友，就能在这里看到他们的帖子了
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="pixel-border p-3" style={{ background: "var(--pixel-panel)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 flex items-center justify-center text-xs shrink-0"
                  style={{ background: post.userAvatar ? "transparent" : stringToColor(post.userName), border: "1px solid var(--pixel-border)" }}
                >
                  {post.userAvatar
                    ? <img src={post.userAvatar} alt="" className="pixel-avatar w-full h-full object-cover" />
                    : post.userName[0]}
                </div>
                <span style={{ fontSize: 13 }}>{post.userName}</span>
                {post.campId && (
                  <span style={{ fontSize: 9, color: "var(--pixel-muted)", background: "var(--pixel-bg)", padding: "1px 4px" }}>
                    ⛺ {post.campId.replace("camp_", "").slice(0, 8)}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "var(--pixel-muted)", marginLeft: "auto" }}>{timeAgo(post.createdAt)}</span>
              </div>

              {/* Markdown 渲染 */}
              <div className="forum-md" style={{ fontSize: 13, lineHeight: 1.7 }}>
                <ReactMarkdown
                  components={{
                    img: ({ src, alt }) => (
                      <img src={src} alt={alt ?? ""} style={{ maxWidth: "100%", maxHeight: 300, border: "1px solid var(--pixel-border)", marginTop: 4, marginBottom: 4 }} />
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pixel-blue)" }}>{children}</a>
                    ),
                    code: ({ children }) => (
                      <code style={{ background: "var(--pixel-bg)", padding: "1px 4px", fontSize: 12 }}>{children}</code>
                    ),
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>

              <div className="flex gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--pixel-border)" }}>
                <button onClick={() => handleLocalReact(post.id, "like")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: post.userReaction === "like" ? "var(--pixel-blue)" : "var(--pixel-muted)" }}>
                  👍 {post.likes || ""}
                </button>
                <button onClick={() => handleLocalReact(post.id, "dislike")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: post.userReaction === "dislike" ? "var(--pixel-accent)" : "var(--pixel-muted)" }}>
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
