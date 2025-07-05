// src/app/layout.tsx

// import './globals.css'; // グローバルCSSをインポート (もしあれば)
import React from 'react';

export const metadata = {
  title: 'どのオンデマンドで観れる？',
  description: '映画名から視聴可能なオンデマンドサービスを検索',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja"><body>{children}</body></html> // ★この行にすべて収める
  );
}