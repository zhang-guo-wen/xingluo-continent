import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecondMe 个人主页",
  description: "集成 SecondMe OAuth 登录的个人信息展示网站",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
