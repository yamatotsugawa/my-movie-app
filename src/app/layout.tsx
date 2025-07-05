// src/app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react"; // ★追加: Vercel Analyticsのインポート

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "どのオンデマンドで観れる？", // アプリのタイトル
  description: "映画の視聴サービスを検索できるアプリ", // アプリの説明
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja"> {/* ★変更: lang属性をjaに設定 */}
      <body className={inter.className}>
        {children}
        <Analytics /> {/* ★追加: Analyticsコンポーネントを配置 */}
      </body>
    </html>
  );
}
