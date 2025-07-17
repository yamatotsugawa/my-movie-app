'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChatSummary } from '@/hooks/useRecentChats';
import { formatDistanceToNow } from '@/utils/time'; // 下に作る簡易関数

interface Props {
  items: ChatSummary[];
  loading?: boolean;
  error?: string | null;
}

export function RecentChatsSidebar({ items, loading, error }: Props) {
  const router = useRouter();

  if (loading) {
    return <div style={styles.box}>読み込み中...</div>;
  }
  if (error) {
    return <div style={styles.box}>読み込みエラー: {error}</div>;
  }
  if (!items.length) {
    return <div style={styles.box}>最近更新されたチャットはありません。</div>;
  }

  return (
    <div style={styles.box}>
      <h3 style={styles.heading}>最近更新されたチャット</h3>
      <ul style={styles.list}>
        {items.map((it) => (
          <li
            key={it.movieId}
            style={styles.item}
            onClick={() => router.push(`/chat/${it.movieId}`)}
          >
            <div style={styles.thumbWrap}>
              {it.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w92${it.poster_path}`}
                  alt={it.title}
                  width={46}
                  height={69}
                  style={{ borderRadius: 4 }}
                />
              ) : (
                <div style={styles.thumbPlaceholder}>No Image</div>
              )}
            </div>
            <div style={styles.meta}>
              <div style={styles.title}>{it.title}</div>
              {it.lastMessageText && (
                <div style={styles.snippet}>{it.lastMessageText}</div>
              )}
              {it.lastMessageAt && (
                <div style={styles.time}>
                  {formatDistanceToNow(it.lastMessageAt)}前
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles: { [k: string]: React.CSSProperties } = {
  box: {
    background: '#fafafa',
    border: '1px solid #e3e3e3',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
  },
  heading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  item: {
    display: 'flex',
    gap: 8,
    padding: '8px 0',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
  },
  thumbWrap: {
    flex: '0 0 auto',
  },
  thumbPlaceholder: {
    width: 46,
    height: 69,
    background: '#ddd',
    fontSize: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    color: '#666',
  },
  meta: {
    flex: '1 1 auto',
    overflow: 'hidden',
  },
  title: {
    fontWeight: 600,
    fontSize: 14,
    lineHeight: 1.2,
    marginBottom: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  snippet: {
    fontSize: 12,
    color: '#666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
    color: '#999',
  },
};
