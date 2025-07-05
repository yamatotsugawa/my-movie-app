// src/app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // globals.css のインポートを確認

import { Analytics } from "@vercel/analytics/next"; // Vercel Analytics のインポート

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
    <html lang="ja">
      <body className={inter.className}>
        {children}
        <Analytics /> {/* Vercel Analytics コンポーネント */}
      </body>
    </html>
  );
}
