'use client';

import Link from 'next/link';
import { ChatSummary } from '@/hooks/useRecentChats';

function formatDateRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  return `${diffDay}日前`;
}

interface Props {
  items: ChatSummary[];
  loading: boolean;
  error: string | null;
}

export function RecentChatsSidebar({ items, loading, error }: Props) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        padding: '16px',
        borderRadius: '12px',
        fontFamily: 'Arial, sans-serif',
        boxShadow: '0 0 6px rgba(0, 0, 0, 0.05)',
      }}
    >
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>最近更新されたチャット</h2>
      {loading && <p>読み込み中...</p>}
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      {!loading && !error && items.length === 0 && <p>まだチャットがありません。</p>}
      {!loading && !error && items.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((chat, index) => (
            <li
              key={chat.movieId}
              style={{
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: index < items.length - 1 ? '1px solid #ddd' : 'none',
              }}
            >
              <Link
                href={`/?q=${encodeURIComponent(chat.title)}`}
                prefetch={false}
                style={{
                  fontWeight: 'bold',
                  fontSize: '15px',
                  color: '#111',
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                {chat.title}
              </Link>

              {chat.lastMessageText && (
                <Link
                  href={`/chat/${chat.movieId}`}
                  prefetch={false}
                  style={{
                    fontSize: '14px',
                    color: '#666',
                    textDecoration: 'none',
                    display: 'block',
                    marginTop: '4px',
                  }}
                >
                  {chat.lastMessageText}
                </Link>
              )}

              {chat.lastMessageAt && (
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                  {formatDateRelative(chat.lastMessageAt)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
