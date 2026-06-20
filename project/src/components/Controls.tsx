import React from 'react';
import { Play, Pause, RotateCcw, Plus, Clock3 } from 'lucide-react';
import { TimerSubject } from '../utils/timeUtils';

interface ControlsProps {
  currentSubject: TimerSubject;
  onToggle: () => void;
  onReset: () => void;
  onNewSubject: () => void;
  onSetTime: () => void;
}

export function Controls({ currentSubject, onToggle, onReset, onNewSubject, onSetTime }: ControlsProps) {
  return (
    <div className="flex flex-wrap justify-center items-center gap-4 mt-8">
      <button
        onClick={onNewSubject}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <Plus size={20} />
        New Subject
      </button>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-6 py-3 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
      >
        {currentSubject.isRunning ? <Pause size={24} /> : <Play size={24} />}
        {currentSubject.isRunning ? 'Pause' : 'Start'}
      </button>
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <RotateCcw size={20} />
        Reset
      </button>
      <button
        onClick={onSetTime}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <Clock3 size={20} />
        Set Time
      </button>
    </div>
  );
}
