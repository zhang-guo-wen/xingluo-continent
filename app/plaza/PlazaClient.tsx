"use client";

import { useEffect, useState, useCallback } from "react";

interface PlazaUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  route: string | null;
  joinedAt: string;
}

interface PlazaPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

export default function PlazaClient() {
  const [users, setUsers] = useState<PlazaUser[]>([]);
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [currentUser, setCurrentUser] = useState<PlazaUser | null>(null);
  const [tab, setTab] = useState<"posts" | "people">("posts");

  const fetchData = useCallback(async () => {
    const [usersRes, postsRes] = await Promise.all([
      fetch("/api/plaza/users"),
      fetch("/api/plaza/posts"),
    ]);
    if (usersRes.ok) {
      const d = await usersRes.json();
      setUsers(d.users);
    }
    if (postsRes.ok) {
      const d = await postsRes.json();
      setPosts(d.posts);
    }
  }, []);

  useEffect(() => {
    // 获取当前用户
    fetch("/api/secondme/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCurrentUser({
            id: d.user.id ?? d.user.email ?? "unknown",
            name: d.user.name ?? d.user.nickname ?? "匿名",
            avatarUrl: d.user.avatarUrl ?? null,
            route: d.user.route ?? null,
            joinedAt: "",
          });
        }
      });
    fetchData();
  }, [fetchData]);

  async function handlePost() {
    if (!newPost.trim() || !currentUser) return;
    setPosting(true);
    try {
      const res = await fetch("/api/plaza/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatarUrl,
          content: newPost,
        }),
      });
      if (res.ok) {
        setNewPost("");
        fetchData();
      }
    } finally {
      setPosting(false);
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* 顶部导航 */}
      <nav className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">广场</h1>
          <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
            {users.length} 人在线
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            个人主页
          </a>
          <a
            href="/api/auth/logout"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            退出
          </a>
        </div>
      </nav>

      {/* 发帖区 */}
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start gap-3">
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">
              {currentUser?.name?.[0] ?? "?"}
            </div>
          )}
          <div className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="说点什么，让大家认识你..."
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handlePost}
                disabled={posting || !newPost.trim()}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                {posting ? "发布中..." : "发布"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-200/60 p-1">
        <button
          onClick={() => setTab("posts")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === "posts"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          动态
        </button>
        <button
          onClick={() => setTab("people")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === "people"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          成员 ({users.length})
        </button>
      </div>

      {/* 动态列表 */}
      {tab === "posts" && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-lg">
              <p className="text-lg text-slate-400">还没有动态</p>
              <p className="mt-1 text-sm text-slate-400">
                发第一条帖子，打破沉默
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="rounded-2xl bg-white p-6 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  {post.userAvatar ? (
                    <img
                      src={post.userAvatar}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">
                      {post.userName?.[0] ?? "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{post.userName}</p>
                    <p className="text-xs text-slate-400">
                      {timeAgo(post.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {post.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* 成员列表 */}
      {tab === "people" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-100"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-500">
                  {user.name?.[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{user.name}</p>
                {user.route ? (
                  <a
                    href={`https://second-me.cn/${user.route}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    second-me.cn/{user.route}
                  </a>
                ) : (
                  <p className="text-xs text-slate-400">SecondMe 用户</p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">
                  {timeAgo(user.joinedAt)} 加入
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
