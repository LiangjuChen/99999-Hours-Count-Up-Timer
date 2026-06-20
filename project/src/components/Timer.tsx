import React from 'react';
import { TimerSubject, formatTime } from '../utils/timeUtils';

interface TimerProps {
  subject: TimerSubject;
}

export function Timer({ subject }: TimerProps) {
  return (
    <div className="text-6xl font-mono tracking-wider">
      <div className={`transition-colors duration-300 ${
        subject.isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
      }`}>
        {formatTime(subject.seconds)}
      </div>
    </div>
  );
}