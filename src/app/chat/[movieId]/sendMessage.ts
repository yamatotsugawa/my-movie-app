import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // ← あなたのパスに合わせて修正

export async function updateChatSummary({
  movieId,
  title,
  poster_path,
  messageText,
}: {
  movieId: number;
  title: string;
  poster_path?: string;
  messageText: string;
}) {
  const summaryRef = doc(db, 'chatSummaries', String(movieId));
  await setDoc(
    summaryRef,
    {
      movieId,
      title,
      poster_path: poster_path ?? null,
      lastMessageAt: serverTimestamp(),
      lastMessageText: messageText.slice(0, 80),
    },
    { merge: true }
  );
}
