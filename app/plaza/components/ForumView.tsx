"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { PlazaPostWithReactions, ReactionType, PostTag, PostComment } from "@/lib/types";
import { timeAgo, stringToColor } from "@/lib/utils";
import * as api from "@/lib/api";
import ModalOverlay from "./modals/ModalOverlay";

const POST_TAGS: PostTag[] = ["首发", "原创", "总结", "实践"];
const TAG_COLORS: Record<string, string> = {
  "首发": "#e94560", "原创": "#6b8cff", "总结": "#4a9c5d", "实践": "#f0c040", "虚假的人类": "#9333ea",
};

interface Props {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  currentReputation: number;
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

/** 从 Markdown 内容提取目录 */
function extractToc(content: string): { level: number; text: string; id: string }[] {
  const toc: { level: number; text: string; id: string }[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) {
      const text = m[2].replace(/[*_`]/g, "").trim();
      const id = "h-" + text.replace(/\s+/g, "-").toLowerCase().slice(0, 30);
      toc.push({ level: m[1].length, text, id });
    }
  }
  return toc;
}

export default function ForumView({ currentUserId, currentUserName, currentUserAvatar, currentReputation, campId, onReact }: Props) {
  const [posts, setPosts] = useState<PlazaPostWithReactions[]>([]);
  const [filter, setFilter] = useState<"all" | "camps" | "friends">("all");

  // 文章详情页
  const [viewingPost, setViewingPost] = useState<PlazaPostWithReactions | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState("");

  // 发帖弹窗
  const [showCompose, setShowCompose] = useState(false);
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [postPrice, setPostPrice] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 审议
  const [appealTarget, setAppealTarget] = useState<{ postId: string; action: ReactionType } | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  useEffect(() => {
    api.fetchForumPosts(currentUserId, filter).then(setPosts).catch(() => {});
  }, [currentUserId, filter]);

  // ============ 文章详情 ============

  async function openArticle(post: PlazaPostWithReactions) {
    // 付费帖子：先检查/扣费
    if (post.price > 0 && post.userId !== currentUserId) {
      const result = await api.readPost(post.id, currentUserId);
      if (result.error) {
        alert(`需要 ${result.required ?? post.price} XLC 才能阅读此文章（${result.error}）`);
        return;
      }
      if (result.paid) {
        // 刚扣费成功，可以继续
      }
    }
    setViewingPost(post);
    api.fetchPostComments(post.id).then(setComments).catch(() => setComments([]));
  }

  async function handleAddComment() {
    if (!viewingPost || !newComment.trim()) return;
    const c = await api.addPostComment(viewingPost.id, currentUserId, currentUserName, newComment.trim());
    setComments((prev) => [...prev, c]);
    setNewComment("");
  }

  async function handleVoteAppealComment(commentId: string, vote: "support" | "oppose") {
    if (!viewingPost) return;
    const { comment } = await api.voteAppealComment(viewingPost.id, commentId, currentUserId, vote);
    setComments((prev) => prev.map((c) => c.id === commentId ? comment : c));
  }

  // ============ 点赞/点踩 ============

  function react(postId: string, action: ReactionType) {
    if (currentReputation <= 0) {
      setAppealTarget({ postId, action });
      setAppealReason("");
      return;
    }
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

  async function submitAppeal() {
    if (!appealTarget || !appealReason.trim()) return;
    setAppealSubmitting(true);
    try {
      const c = await api.addAppealComment(appealTarget.postId, currentUserId, currentUserName, appealTarget.action, appealReason.trim());
      if (viewingPost?.id === appealTarget.postId) setComments((prev) => [...prev, c]);
      setAppealTarget(null);
      alert("审议已发起，在评论区等待投票");
    } finally { setAppealSubmitting(false); }
  }

  // ============ 发帖 ============

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      // 平台手动发帖自动加「虚假的人类」标签
      const tags = [...selectedTags, "虚假的人类"];
      await api.createPost({ userId: currentUserId, userName: currentUserName, userAvatar: currentUserAvatar, campId, tags, price: Number(postPrice) || 0, content });
      setContent(""); setSelectedTags(new Set()); setPostPrice(""); setShowCompose(false);
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

  const toc = viewingPost ? extractToc(viewingPost.content) : [];

  // ============ 文章详情页（全屏三栏） ============

  if (viewingPost) {
    return (
      <div className="absolute inset-0" style={{ bottom: 56, display: "flex", color: "var(--pixel-text)" }}>

        {/* 左栏：目录 */}
        <div className="shrink-0 overflow-y-auto" style={{ width: 180, background: "rgba(22,33,62,0.95)", borderRight: "2px solid var(--pixel-border)", padding: 12 }}>
          <button onClick={() => setViewingPost(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pixel-blue)", fontSize: 12, marginBottom: 12 }}>
            ← 返回列表
          </button>
          <div className="pixel-font mb-2" style={{ fontSize: 8, color: "var(--pixel-gold)" }}>目录</div>
          {toc.length === 0 ? (
            <div style={{ fontSize: 10, color: "var(--pixel-muted)" }}>无标题结构</div>
          ) : (
            toc.map((item, i) => (
              <a key={i} href={`#${item.id}`}
                style={{ display: "block", fontSize: 10, color: "var(--pixel-text)", padding: "3px 0",
                  paddingLeft: (item.level - 1) * 10, textDecoration: "none", lineHeight: 1.4 }}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                }}>
                {item.text}
              </a>
            ))
          )}
        </div>

        {/* 中栏：文章内容 */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px" }}>
          {/* 作者信息 */}
          <div className="flex items-center gap-2 mb-4">
            {(viewingPost.tags ?? []).map((t) => (
              <span key={t} style={{ fontSize: 10, padding: "2px 8px", color: "#fff", background: TAG_COLORS[t as PostTag] ?? "var(--pixel-muted)", borderRadius: 3, marginRight: 2 }}>
                {t}
              </span>
            ))}
            <div className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ background: viewingPost.userAvatar ? "transparent" : stringToColor(viewingPost.userName), border: "1px solid var(--pixel-border)", fontSize: 14 }}>
              {viewingPost.userAvatar ? <img src={viewingPost.userAvatar} alt="" className="pixel-avatar w-full h-full object-cover" /> : viewingPost.userName[0]}
            </div>
            <div>
              <div style={{ fontSize: 13 }}>{viewingPost.userName}</div>
              <div style={{ fontSize: 10, color: "var(--pixel-muted)" }}>{timeAgo(viewingPost.createdAt)}</div>
            </div>
          </div>

          {/* Markdown 全文 */}
          <div className="forum-md" style={{ fontSize: 14, lineHeight: 1.9, maxWidth: 700 }}>
            <ReactMarkdown
              components={{
                h1: ({ children }) => { const t = String(children); return <h1 id={"h-" + t.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}>{children}</h1>; },
                h2: ({ children }) => { const t = String(children); return <h2 id={"h-" + t.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}>{children}</h2>; },
                h3: ({ children }) => { const t = String(children); return <h3 id={"h-" + t.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}>{children}</h3>; },
                img: ({ src, alt }) => <img src={src} alt={alt ?? ""} style={{ maxWidth: "100%", maxHeight: 400, border: "1px solid var(--pixel-border)", margin: "8px 0" }} />,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--pixel-blue)" }}>{children}</a>,
                code: ({ children }) => <code style={{ background: "var(--pixel-bg)", padding: "2px 6px", fontSize: 13 }}>{children}</code>,
              }}
            >{viewingPost.content}</ReactMarkdown>
          </div>

          {/* 点赞 */}
          <div className="flex gap-4 mt-6 pt-3" style={{ borderTop: "1px solid var(--pixel-border)" }}>
            <button onClick={() => react(viewingPost.id, "like")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: viewingPost.userReaction === "like" ? "var(--pixel-blue)" : "var(--pixel-muted)" }}>
              👍 {viewingPost.likes || 0}</button>
            <button onClick={() => react(viewingPost.id, "dislike")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: viewingPost.userReaction === "dislike" ? "var(--pixel-accent)" : "var(--pixel-muted)" }}>
              👎 {viewingPost.dislikes || 0}</button>
          </div>
        </div>

        {/* 右栏：评论区 */}
        <div className="shrink-0 overflow-y-auto" style={{ width: 280, background: "rgba(22,33,62,0.95)", borderLeft: "2px solid var(--pixel-border)", padding: 12 }}>
          <div className="pixel-font mb-3" style={{ fontSize: 9, color: "var(--pixel-gold)" }}>评论 ({comments.length})</div>

          <div style={{ marginBottom: 8 }}>
            {comments.map((c) => (
              <div key={c.id} className="mb-2 pl-2" style={{ borderLeft: c.type === "appeal" ? "3px solid var(--pixel-accent)" : "2px solid var(--pixel-border)" }}>
                {c.type === "appeal" ? (
                  <div className="p-2" style={{ background: "rgba(233,69,96,0.1)" }}>
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <span style={{ fontSize: 8, padding: "1px 4px", background: "var(--pixel-accent)", color: "#fff" }}>🗳️</span>
                      <span style={{ fontSize: 10, color: "var(--pixel-gold)" }}>{c.userName}</span>
                      <span style={{ fontSize: 9, color: "var(--pixel-muted)" }}>
                        想{c.appealAction === "like" ? "👍赞" : "👎踩"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, marginBottom: 4 }}>{c.content}</div>
                    {c.appealStatus === "pending" ? (
                      <div className="flex gap-2" style={{ fontSize: 10 }}>
                        <button onClick={() => handleVoteAppealComment(c.id, "support")}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pixel-green)" }}>✅{c.supportCount}</button>
                        <button onClick={() => handleVoteAppealComment(c.id, "oppose")}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pixel-accent)" }}>❌{c.opposeCount}</button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 9, color: c.appealStatus === "approved" ? "var(--pixel-green)" : "var(--pixel-accent)" }}>
                        {c.appealStatus === "approved" ? "✅通过" : "❌拒绝"}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-1">
                    <div style={{ fontSize: 10, color: "var(--pixel-gold)" }}>{c.userName}</div>
                    <div style={{ fontSize: 11 }}>{c.content}</div>
                    <div style={{ fontSize: 8, color: "var(--pixel-muted)" }}>{timeAgo(c.createdAt)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 写评论 */}
          <div className="flex gap-1">
            <input className="pixel-input flex-1" style={{ fontSize: 11, padding: "4px 6px" }}
              placeholder="写评论..." value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()} />
            <button className="pixel-btn pixel-btn-accent" style={{ fontSize: 9, padding: "4px 8px" }}
              onClick={handleAddComment}>发</button>
          </div>
        </div>

        {/* 审议弹窗（详情页内） */}
        {appealTarget && (
          <ModalOverlay onClose={() => setAppealTarget(null)}>
            <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-accent)" }}>⚠️ 信誉不足</div>
            <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginBottom: 8, lineHeight: 1.6 }}>
              信誉分 {currentReputation}，不能直接{appealTarget.action === "like" ? "点赞" : "点踩"}。说明理由发起审议，3人支持则通过。
            </div>
            <textarea className="pixel-textarea mb-3" rows={3} placeholder="理由..."
              value={appealReason} onChange={(e) => setAppealReason(e.target.value)} />
            <div className="flex gap-2">
              <button className="pixel-btn pixel-btn-accent" onClick={submitAppeal} disabled={appealSubmitting || !appealReason.trim()}>
                {appealSubmitting ? "提交中..." : "发起审议"}</button>
              <button className="pixel-btn" onClick={() => setAppealTarget(null)}>取消</button>
            </div>
          </ModalOverlay>
        )}
      </div>
    );
  }

  // ============ 卡片列表页 ============

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
            {filter === "camps" ? "关注营地看帖子" : filter === "friends" ? "添加好友看帖子" : "关注营地或加好友看帖子"}
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="pixel-border p-3 cursor-pointer" style={{ background: "var(--pixel-panel)" }}
              onClick={() => openArticle(post)}>
              <div className="flex items-center gap-2 mb-1">
                {(post.tags ?? []).map((t) => (
                  <span key={t} style={{ fontSize: 9, padding: "1px 5px", color: "#fff", background: TAG_COLORS[t as PostTag] ?? "var(--pixel-muted)", borderRadius: 2, marginRight: 2 }}>
                    {t}
                  </span>
                ))}
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
                <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 2, background: post.source === "mcp" ? "rgba(96,165,250,0.15)" : "rgba(147,51,234,0.15)", color: post.source === "mcp" ? "var(--pixel-blue)" : "#a855f7" }}>
                  {post.source === "mcp" ? "🤖 AI" : "👤 人类"}
                </span>
                {(post.price ?? 0) > 0 && (
                  <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--pixel-gold)", color: "#000", borderRadius: 3, fontWeight: 600 }}>🪙 {post.price} XLC</span>
                )}
                {(post.price ?? 0) === 0 && (
                  <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(74,222,128,0.15)", color: "var(--pixel-green)", borderRadius: 3 }}>免费</span>
                )}
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
                <span style={{ color: "var(--pixel-muted)" }}>💬 {post.commentCount || 0}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB 发帖 */}
      <button className="action-fab" style={{ bottom: 70, zIndex: 45 }} onClick={() => setShowCompose(true)}>✏️</button>

      {/* 发帖弹窗 */}
      {showCompose && (
        <ModalOverlay onClose={() => setShowCompose(false)}>
          <div className="pixel-font mb-3" style={{ fontSize: 14 }}>发布文章</div>
          <div className="flex gap-1 mb-3">
            {POST_TAGS.filter((t) => t !== "虚假的人类").map((t) => (
              <button key={t} onClick={() => setSelectedTags((prev) => { const s = new Set(prev); if (s.has(t)) s.delete(t); else s.add(t); return s; })}
                style={{ fontSize: 10, padding: "3px 10px", border: "none", cursor: "pointer", borderRadius: 3,
                  background: selectedTags.has(t) ? TAG_COLORS[t] : "var(--pixel-bg)",
                  color: selectedTags.has(t) ? "#fff" : "var(--pixel-muted)" }}>{t}</button>
            ))}
          </div>
          <textarea ref={textareaRef} className="pixel-textarea mb-2" rows={12}
            placeholder={"# 标题\n\n正文内容...\n\n支持 Markdown，粘贴图片自动上传"}
            value={content} onChange={(e) => setContent(e.target.value)} onPaste={handlePaste}
            style={{ minHeight: 200 }} />
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 11, color: "var(--pixel-muted)" }}>阅读费用</span>
            <input className="pixel-input" type="number" step="0.00001" min="0" placeholder="0（免费）"
              value={postPrice} onChange={(e) => setPostPrice(e.target.value)}
              style={{ width: 120, fontSize: 12, padding: "4px 8px" }} />
            <span style={{ fontSize: 10, color: "var(--pixel-gold)" }}>XLC</span>
            <span style={{ fontSize: 9, color: "var(--pixel-muted)" }}>0=免费，支持5位小数</span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 9, color: "var(--pixel-muted)" }}>{uploading ? "📤 上传中..." : "Markdown · 粘贴图片自动上传"}</span>
            <div className="flex gap-2">
              <button className="pixel-btn pixel-btn-accent" onClick={handlePost} disabled={posting || !content.trim()}>
                {posting ? "发布中..." : "发布"}</button>
              <button className="pixel-btn" onClick={() => setShowCompose(false)}>取消</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 审议弹窗 */}
      {appealTarget && (
        <ModalOverlay onClose={() => setAppealTarget(null)}>
          <div className="pixel-font mb-3" style={{ fontSize: 14, color: "var(--pixel-accent)" }}>⚠️ 信誉不足</div>
          <div style={{ fontSize: 13, color: "var(--pixel-muted)", marginBottom: 8, lineHeight: 1.6 }}>
            信誉分 {currentReputation}，不能直接{appealTarget.action === "like" ? "点赞" : "点踩"}。说明理由发起审议，3人支持则通过。
          </div>
          <textarea className="pixel-textarea mb-3" rows={3} placeholder="理由..."
            value={appealReason} onChange={(e) => setAppealReason(e.target.value)} />
          <div className="flex gap-2">
            <button className="pixel-btn pixel-btn-accent" onClick={submitAppeal} disabled={appealSubmitting || !appealReason.trim()}>
              {appealSubmitting ? "提交中..." : "发起审议"}</button>
            <button className="pixel-btn" onClick={() => setAppealTarget(null)}>取消</button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
