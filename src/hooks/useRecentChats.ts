'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ChatSummary {
  movieId: number;
  title: string;
  poster_path?: string | null;
  lastMessageAt?: Date | null; // Firestore → Date
  lastMessageText?: string | null;
}

export function useRecentChats(topN: number = 10, realtime = true) {
  const [items, setItems] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const colRef = collection(db, 'chatSummaries');
    const q = query(colRef, orderBy('lastMessageAt', 'desc'), limit(topN));

    if (realtime) {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const arr: ChatSummary[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              movieId: Number(data.movieId ?? d.id),
              title: data.title ?? '(無題)',
              poster_path: data.poster_path ?? null,
              lastMessageAt: data.lastMessageAt?.toDate?.() ?? null,
              lastMessageText: data.lastMessageText ?? null,
            };
          });
          setItems(arr);
          setLoading(false);
        },
        (err) => {
          console.error(err);
          setError(err.message);
          setLoading(false);
        }
      );
      return unsub;
    } else {
      (async () => {
        try {
          const snap = await getDocs(q);
          const arr: ChatSummary[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              movieId: Number(data.movieId ?? d.id),
              title: data.title ?? '(無題)',
              poster_path: data.poster_path ?? null,
              lastMessageAt: data.lastMessageAt?.toDate?.() ?? null,
              lastMessageText: data.lastMessageText ?? null,
            };
          });
          setItems(arr);
        } catch (e: any) {
          setError(e.message);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [topN, realtime]);

  return { items, loading, error };
}
