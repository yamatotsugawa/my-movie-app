'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { updateChatSummary } from '@/lib/updateChatSummary';

// 🔹 チャットメッセージの型定義
type ChatMessage = {
  id: string;
  text: string;
  createdAt: Timestamp;
};

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_API_URL = 'https://api.themoviedb.org/3';

export default function ChatRoom() {
  const params = useParams();
  const movieId = params.movieId as string;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [movieTitle, setMovieTitle] = useState('');
  const [moviePosterPath, setMoviePosterPath] = useState<string | null>(null);

  // 🔹 映画タイトルとポスターを取得
  useEffect(() => {
    if (!movieId) return;

    const fetchTitle = async () => {
      try {
        const res = await fetch(
          `${TMDB_API_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ja-JP`
        );
        const data = await res.json();
        setMovieTitle(data.title || `ID: ${movieId}`);
        setMoviePosterPath(data.poster_path || null);
      } catch (err) {
        console.error('映画タイトル取得エラー:', err);
        setMovieTitle(`ID: ${movieId}`);
      }
    };

    fetchTitle();
  }, [movieId]);

  // 🔹 チャットメッセージ取得
  useEffect(() => {
    if (!movieId) return;

    const q = query(
      collection(db, `movies/${movieId}/messages`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = snapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          text: data.text,
          createdAt: data.createdAt,
        };
      });
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [movieId]);

  // 🔹 メッセージ送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    await addDoc(collection(db, `movies/${movieId}/messages`), {
      text: message,
      createdAt: Timestamp.now(),
    });

    await updateChatSummary({
      movieId: Number(movieId),
      title: movieTitle,
      poster_path: moviePosterPath,
      messageText: message,
    });

    setMessage('');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>この映画「{movieTitle}」について語ろう</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="メッセージを入力（改行もできます）"
          style={styles.textarea}
          rows={4}
        />
        <button type="submit" style={styles.button}>送信</button>
      </form>

      <div style={styles.chatContainer}>
        {loading ? (
          <p>読み込み中...</p>
        ) : messages.length === 0 ? (
          <p>最初に書き込み者になろう！</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={styles.message}>
              <span>{msg.text}</span>
              <span style={styles.timestamp}>
                {msg.createdAt?.toDate?.().toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }) ?? ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: 600,
    margin: '40px auto',
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    fontSize: '24px',
    textAlign: 'center',
    marginBottom: 20,
  },
  form: {
    display: 'flex',
    marginBottom: 20,
  },
  textarea: {
    flex: 1,
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginRight: '10px',
    resize: 'vertical',
  },
  button: {
    padding: '10px 16px',
    fontSize: '16px',
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  chatContainer: {
    backgroundColor: '#fff',
    padding: '10px',
    borderRadius: '5px',
    maxHeight: '400px',
    overflowY: 'auto',
    border: '1px solid #eee',
  },
  message: {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    whiteSpace: 'pre-wrap',
  },
  timestamp: {
    fontSize: '12px',
    color: '#999',
    marginLeft: 10,
    whiteSpace: 'nowrap',
  },
};