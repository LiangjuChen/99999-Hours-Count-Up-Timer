import React from 'react';
import { Trash2 } from 'lucide-react';
import { TimerSubject } from '../utils/timeUtils';

interface TimerInfoProps {
  subjects: TimerSubject[];
  currentSubject: TimerSubject;
  onSelectSubject: (subject: TimerSubject) => void;
  onDeleteSubject: (subjectId: string) => void;
}

export function TimerInfo({ subjects, currentSubject, onSelectSubject, onDeleteSubject }: TimerInfoProps) {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Subjects</h2>
      <div className="flex flex-wrap gap-3">
        {subjects.map((subject) => (
          <div key={subject.id} className="flex items-center">
            <button
              onClick={() => onSelectSubject(subject)}
              className={`px-4 py-2 rounded-l-lg transition-colors ${
                currentSubject.id === subject.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {subject.name}
            </button>
            <button
              onClick={() => onDeleteSubject(subject.id)}
              className={`p-2 rounded-r-lg transition-colors ${
                currentSubject.id === subject.id
                  ? 'bg-blue-700 text-white hover:bg-blue-800'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
              }`}
              title="Delete subject"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}