"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { PlazaPostWithReactions, ReactionType, PostTag } from "@/lib/types";
import { timeAgo, stringToColor } from "@/lib/utils";
import * as api from "@/lib/api";
import ModalOverlay from "./modals/ModalOverlay";

const POST_TAGS: PostTag[] = ["首发", "原创", "总结", "实践"];
const TAG_COLORS: Record<PostTag, string> = {
  "首发": "#e94560", "原创": "#6b8cff", "总结": "#4a9c5d", "实践": "#f0c040",
};

interface Props {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  campId: string;
  onReact: (postId: string, action: ReactionType) => void;
}

function getSummary(md: string, max = 80): string {
  return md.replace(/!\[.*?\]\(.*?\)/g, "[图片]").replace(/\[([^\]]*)\]\(.*?\)/g, "$1")
    .replace(/[*_`#>~-]/g, "").replace(/\n+/g, " ").trim().slice(0, max) + (md.length > max ? "..." : "");
}

function getTitle(content: string): string {
  const first = content.split("\n")[0].replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim();
  return first.length > 40 ? first.slice(0, 40) + "..." : first || "无标题";
}

export default function ForumView({ currentUserId, currentUserName, currentUserAvatar, campId, onReact }: Props) {
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [filter, setFilter] = useState<"all" | "camps" | "friends">("all");
  const [viewingPost, setViewingPost] = useState<PlazaPostWithReactions | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [content, setContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<PostTag | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.fetchForumPosts(currentUserId, filter).then(setPosts).catch(() => {});
  }, [currentUserId, filter]);

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      await api.createPost({
        userId: currentUserId, userName: currentUserName,
        userAvatar: currentUserAvatar, campId, tag: selectedTag ?? undefined, content,
      });
      setContent(""); setSelectedTag(null); setShowCompose(false);
      api.fetchForumPosts(currentUserId, filter).then(setPosts);
    } finally { setPosting(false); }
  }

  async function handlePaste(e: React.ClipboardEvent) {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setUploading(true);
        try {
          const url = await api.uploadImage(currentUserId, file);
          const img = `![图片](${url})\n`;
          const ta = textareaRef.current;
          if (ta) { const s = ta.selectionStart; setContent((p) => p.slice(0, s) + img + p.slice(s)); }
          else setContent((p) => p + img);
        } catch { alert("图片上传失败"); }
        finally { setUploading(false); }
      }
    }
  }

  function react(postId: string, action: ReactionType) {
    onReact(postId, action);
    const upd = (list: PlazaPostWithReactions[]) => list.map((p) => {
      if (p.id !== postId) return p;
      const wl = p.userReaction === "like", wd = p.userReaction === "dislike";
      if (action === "like") return { ...p, likes: wl ? p.likes - 1 : p.likes + 1, dislikes: wd ? p.dislikes - 1 : p.dislikes, userReaction: wl ? null : "like" as const };
      return { ...p, dislikes: wd ? p.dislikes - 1 : p.dislikes + 1, likes: wl ? p.likes - 1 : p.likes, userReaction: wd ? null : "dislike" as const };
    });
    setPosts(upd);
    if (viewingPost?.id === postId) setViewingPost((v) => v ? upd([v])[0] : null);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-16 pt-4 px-4" style={{ color: "var(--pixel-text)" }}>
      <h2 className="pixel-font text-center mb-2" style={{ fontSize: 14 }}>论坛</h2>

      {/* 来源切换 */}
      <div className="flex gap-1 mb-4 p-1 max-w-2xl mx-auto" style={{ background: "rgba(15,52,96,0.5)" }}>
        {([
          { key: "all" as const, label: "全部" },
          { key: "camps" as const, label: "⛺ 营地" },
          { key: "friends" as const, label: "👫 好友" },
        ]).map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)} className="flex-1 py-1.5 text-center"
            style={{ fontSize: 11, border: "none", cursor: "pointer",
              background: filter === t.key ? "var(--pixel-panel)" : "transparent",
              color: filter === t.key ? "var(--pixel-gold)" : "var(--pixel-muted)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 卡片列表 */}
      <div className="max-w-2xl mx-auto space-y-2">
        {posts.length === 0 ? (
          <div className="text-center" style={{ color: "var(--pixel-muted)", fontSize: 13, padding: 20 }}>
            {filter === "camps" ? "关注一些营地看到帖子" : filter === "friends" ? "添加好友看到帖子" : "关注营地或添加好友看帖子"}
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="pixel-border p-3 cursor-pointer" style={{ background: "var(--pixel-panel)" }}
              onClick={() => setViewingPost(post)}>
              <div className="flex items-center gap-2 mb-1">
                {/* 标签 */}
                {post.tag && (
                  <span style={{ fontSize: 9, padding: "1px 6px", color: "#fff", background: TAG_COLORS[post.tag as PostTag] ?? "var(--pixel-muted)" }}>
                    {post.tag}
                  </span>
                )}
                <span style={{ fontSize: 14, fontWeight: "bold", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {getTitle(post.content)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 flex items-center justify-center shrink-0"
                  style={{ background: post.userAvatar ? "transparent" : stringToColor(post.userName), border: "1px solid var(--pixel-border)", fontSize: 8 }}>
                  {post.userAvatar ? <img src={post.userAvatar} alt="" className="pixel-avatar w-full h-full object-cover" /> : post.userName[0]}
                </div>
                <span style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{post.userName}</span>
                <span style={{ fontSize: 9, color: "var(--pixel-muted)", marginLeft: "auto" }}>{timeAgo(post.createdAt)}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--pixel-muted)", lineHeight: 1.4, height: 34, overflow: "hidden" }}>
                {getSummary(post.content)}
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--pixel-border)", fontSize: 11 }}>
                <span style={{ color: post.userReaction === "like" ? "var(--pixel-blue)" : "var(--pixel-muted)", cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); react(post.id, "like"); }}>👍 {post.likes || 0}</span>
                <span style={{ color: post.userReaction === "dislike" ? "var(--pixel-accent)" : "var(--pixel-muted)", cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); react(post.id, "dislike"); }}>👎 {post.dislikes || 0}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB 发帖 */}
      <button className="action-fab" style={{ bottom: 70, zIndex: 45 }} onClick={() => setShowCompose(true)}>✏️</button>

      {/* 帖子详情 */}
      {viewingPost && (
        <ModalOverlay onClose={() => setViewingPost(null)}>
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <div className="flex items-center gap-2 mb-3">
              {viewingPost.tag && (
                <span style={{ fontSize: 10, padding: "2px 8px", color: "#fff", background: TAG_COLORS[viewingPost.tag as PostTag] ?? "var(--pixel-muted)" }}>
                  {viewingPost.tag}
                </span>
              )}
              <div className="w-7 h-7 flex items-center justify-center shrink-0"
                style={{ background: viewingPost.userAvatar ? "transparent" : stringToColor(viewingPost.userName), border: "1px solid var(--pixel-border)", fontSize: 12 }}>
                {viewingPost.userAvatar ? <img src={viewingPost.userAvatar} alt="" className="pixel-avatar w-full h-full object-cover" /> : viewingPost.userName[0]}
              </div>
              <div>
                <div style={{ fontSize: 13 }}>{viewingPost.userName}</div>
                <div style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{timeAgo(viewingPost.createdAt)}</div>
              </div>
            </div>
            <div className="forum-md" style={{ fontSize: 14, lineHeight: 1.8 }}>
              <ReactMarkdown
                components={{
                  img: ({ src, alt }) => <img src={src} alt={alt ?? ""} style={{ maxWidth: "100%", maxHeight: 400, border: "1px solid var(--pixel-border)", margin: "8px 0" }} />,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pixel-blue)" }}>{children}</a>,
                  code: ({ children }) => <code style={{ background: "var(--pixel-bg)", padding: "2px 6px", fontSize: 13 }}>{children}</code>,
                }}
              >{viewingPost.content}</ReactMarkdown>
            </div>
            <div className="flex gap-4 mt-4 pt-3" style={{ borderTop: "1px solid var(--pixel-border)" }}>
              <button onClick={() => react(viewingPost.id, "like")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: viewingPost.userReaction === "like" ? "var(--pixel-blue)" : "var(--pixel-muted)" }}>
                👍 {viewingPost.likes || 0}</button>
              <button onClick={() => react(viewingPost.id, "dislike")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: viewingPost.userReaction === "dislike" ? "var(--pixel-accent)" : "var(--pixel-muted)" }}>
                👎 {viewingPost.dislikes || 0}</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 发帖弹窗 */}
      {showCompose && (
        <ModalOverlay onClose={() => setShowCompose(false)}>
          <div className="pixel-font mb-3" style={{ fontSize: 14 }}>发布文章</div>

          {/* 标签选择 */}
          <div className="flex gap-1 mb-3">
            {POST_TAGS.map((t) => (
              <button key={t} onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                style={{
                  fontSize: 10, padding: "3px 10px", border: "none", cursor: "pointer",
                  background: selectedTag === t ? TAG_COLORS[t] : "var(--pixel-bg)",
                  color: selectedTag === t ? "#fff" : "var(--pixel-muted)",
                }}>{t}</button>
            ))}
          </div>

          <textarea ref={textareaRef} className="pixel-textarea mb-2" rows={12}
            placeholder={"# 标题\n\n正文内容...\n\n支持 Markdown，粘贴图片自动上传"}
            value={content} onChange={(e) => setContent(e.target.value)} onPaste={handlePaste}
            style={{ minHeight: 240 }} />
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 9, color: "var(--pixel-muted)" }}>
              {uploading ? "📤 上传中..." : "Markdown · 粘贴图片自动上传"}
            </span>
            <div className="flex gap-2">
              <button className="pixel-btn pixel-btn-accent" onClick={handlePost} disabled={posting || !content.trim()}>
                {posting ? "发布中..." : "发布"}</button>
              <button className="pixel-btn" onClick={() => setShowCompose(false)}>取消</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
