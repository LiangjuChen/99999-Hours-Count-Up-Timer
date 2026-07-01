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

export function parseManualTime(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map(part => part.trim());
  if (parts.length > 3 || parts.some(part => !/^\d+$/.test(part))) {
    return null;
  }

  const numbers = parts.map(Number);
  if (numbers.some(num => !Number.isSafeInteger(num) || num < 0)) {
    return null;
  }

  if (numbers.length === 1) {
    return numbers[0];
  }

  const seconds = numbers[numbers.length - 1];
  const minutes = numbers[numbers.length - 2];
  const hours = numbers.length === 3 ? numbers[0] : 0;

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
