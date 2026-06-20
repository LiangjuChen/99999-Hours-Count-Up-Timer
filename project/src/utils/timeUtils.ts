export interface TimerSubject {
  id: string;
  name: string;
  seconds: number;
  isRunning: boolean;
}

export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${hours.toString().padStart(5, '0')}:${pad(minutes)}:${pad(seconds)}`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}