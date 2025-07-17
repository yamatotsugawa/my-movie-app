import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function updateChatSummary({
  movieId,
  title,
  poster_path,
  messageText,
}: {
  movieId: number;
  title: string;
  poster_path?: string | null;
  messageText: string;
}) {
  const ref = doc(db, 'chatSummaries', String(movieId));
  await setDoc(ref, {
    movieId,
    title,
    poster_path: poster_path ?? null,
    lastMessageText: messageText.slice(0, 80),
    lastMessageAt: serverTimestamp(),
  }, { merge: true });
}
