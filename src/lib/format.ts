export function formatTime(milliseconds: number): string {
  const total = Math.floor(milliseconds / 1000);
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}
