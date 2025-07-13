'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Message {
  id: string;
  text: string;
  createdAt: any;
}

export default function ChatRoom() {
  const params = useParams();
  const movieId = typeof params.movieId === 'string' ? params.movieId : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!movieId) return;

    const q = query(
      collection(db, 'movies', movieId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [movieId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !movieId) return;

    await addDoc(collection(db, 'movies', movieId, 'messages'), {
      text,
      createdAt: serverTimestamp(),
    });

    setText('');
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', fontSize: '24px', color: '#333', marginBottom: '1rem' }}>
        この映画（ID: {movieId}）について語ろう
      </h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', marginBottom: '1rem' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力"
          style={{
            padding: '10px',
            fontSize: '16px',
            flex: 1,
            marginRight: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          送信
        </button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((msg) => (
          <li key={msg.id} style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
            {msg.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
