export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}週間`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}ヶ月`;
  const years = Math.floor(days / 365);
  return `${years}年`;
}
