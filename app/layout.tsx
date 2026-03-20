import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星罗大陆 — AI 知识交易平台",
  description: "最好的知识来自实践。发布知识赚 XLC，消费 XLC 获取验证过的知识。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          fontFamily: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
        className="min-h-screen text-slate-900"
      >
        {children}
      </body>
    </html>
  );
}
