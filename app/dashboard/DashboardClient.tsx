"use client";

import { useEffect, useState } from "react";

interface UserInfo {
  name?: string;
  email?: string;
  avatarUrl?: string;
  route?: string;
  [key: string]: unknown;
}

interface Shade {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

interface Memory {
  content?: string;
  summary?: string;
  [key: string]: unknown;
}

interface UserData {
  user: UserInfo | null;
  shades: Shade[];
  memories: Memory[];
}

export default function DashboardClient() {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/secondme/user")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/";
          return;
        }
        if (!res.ok) throw new Error("获取数据失败");
        return res.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl bg-red-50 p-6 text-red-700">
          <p className="font-medium">加载失败</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </main>
    );
  }

  const user = data?.user;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {/* 顶部导航 */}
      <nav className="mb-10 flex items-center justify-between">
        <h1 className="text-xl font-bold">SecondMe</h1>
        <a
          href="/api/auth/logout"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          退出登录
        </a>
      </nav>

      {/* 用户卡片 */}
      <section className="rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex items-center gap-6">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt="头像"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-slate-100"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-500">
              {user?.name?.[0] ?? "?"}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{user?.name ?? "未设置昵称"}</h2>
            {user?.email && (
              <p className="mt-1 text-slate-500">{user.email}</p>
            )}
            {user?.route && (
              <a
                href={`https://second-me.cn/${user.route}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-blue-600 hover:underline"
              >
                second-me.cn/{user.route}
              </a>
            )}
          </div>
        </div>

        {/* 详细信息表格 */}
        <div className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-slate-700">基本信息</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(user ?? {}).map(([key, value]) => {
                  if (
                    value === null ||
                    value === undefined ||
                    value === "" ||
                    typeof value === "object"
                  )
                    return null;
                  return (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">
                        {key}
                      </td>
                      <td className="px-4 py-3 text-slate-900 break-all">
                        {String(value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 兴趣标签 */}
      {data?.shades && data.shades.length > 0 && (
        <section className="mt-8 rounded-2xl bg-white p-8 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-slate-700">
            兴趣标签
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.shades.map((shade, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700"
                title={shade.description}
              >
                {shade.name ?? JSON.stringify(shade)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 软记忆 */}
      {data?.memories && data.memories.length > 0 && (
        <section className="mt-8 rounded-2xl bg-white p-8 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-slate-700">
            软记忆
          </h3>
          <div className="space-y-3">
            {data.memories.map((mem, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700"
              >
                {mem.content ?? mem.summary ?? JSON.stringify(mem)}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
