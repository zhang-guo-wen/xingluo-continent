import { getTokenFromCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const token = await getTokenFromCookie();
  if (token) {
    redirect("/plaza");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">SecondMe</h1>
          <p className="mt-3 text-slate-500">
            登录 SecondMe，进入广场认识大家
          </p>
        </div>

        <a
          href="/api/auth/login"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-base font-medium text-white transition hover:bg-slate-800"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
            />
          </svg>
          使用 SecondMe 登录
        </a>

        <p className="text-center text-xs text-slate-400">
          点击登录将跳转至 SecondMe 授权页面
        </p>
      </div>
    </main>
  );
}
