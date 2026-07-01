import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Timer } from './components/Timer';
import { Controls } from './components/Controls';
import { TimerInfo } from './components/TimerInfo';
import { ThemeToggle } from './components/ThemeToggle';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { TimerSubject, formatTime, generateId, parseManualTime } from './utils/timeUtils';

type TimerSubjectRow = {
  id: string;
  name: string;
  seconds: number;
  is_running: boolean;
};

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so the timer UI remains available.
  }
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 5000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    }),
  ]);
}

function createDefaultSubject(): TimerSubject {
  return {
    id: generateId(),
    name: 'General',
    seconds: 0,
    isRunning: false,
  };
}

function loadLocalSubjects(): TimerSubject[] {
  try {
    const stored = readStorage('timerSubjects');
    if (!stored) return [createDefaultSubject()];

    const parsed = JSON.parse(stored) as Partial<TimerSubject>[];
    const subjects = parsed
      .filter(subject => subject.name && typeof subject.seconds === 'number')
      .map(subject => ({
        id: subject.id || generateId(),
        name: subject.name!,
        seconds: Math.max(0, Math.floor(subject.seconds!)),
        isRunning: Boolean(subject.isRunning),
      }));

    return subjects.length > 0 ? subjects : [createDefaultSubject()];
  } catch {
    return [createDefaultSubject()];
  }
}

function App() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return readStorage('theme') === 'dark' ||
        (!readStorage('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [subjects, setSubjects] = useState<TimerSubject[]>([]);
  const [currentSubjectId, setCurrentSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(isSupabaseConfigured);
  const subjectsRef = useRef(subjects);
  subjectsRef.current = subjects;

  // Fetch from Supabase on mount, with localStorage migration
  useEffect(() => {
    async function loadSubjects() {
      const forceLocalOnly = readStorage('forceLocalOnly') === 'true';
      if (forceLocalOnly || !isSupabaseConfigured) {
        const localSubjects = loadLocalSubjects();
        setSubjects(localSubjects);
        setCurrentSubjectId(localSubjects[0].id);
        setCloudSyncEnabled(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await withTimeout(
          supabase
            .from('timer_subjects')
            .select('*')
            .order('created_at', { ascending: true })
        );

        if (error) throw error;

        if (data && data.length > 0) {
          const cloudSubjects = (data as TimerSubjectRow[]).map((s) => ({
            id: s.id,
            name: s.name,
            seconds: s.seconds,
            isRunning: s.is_running,
          }));
          const hasLocalBackup = Boolean(readStorage('timerSubjects'));
          const localSubjects = hasLocalBackup ? loadLocalSubjects() : [];
          const mergedSubjects = cloudSubjects.map(cloudSubject => {
            const localSubject = localSubjects.find(subject =>
              subject.id === cloudSubject.id || subject.name === cloudSubject.name
            );

            if (!localSubject) return cloudSubject;

            return {
              ...cloudSubject,
              name: localSubject.name || cloudSubject.name,
              seconds: Math.max(cloudSubject.seconds, localSubject.seconds),
              isRunning: localSubject.isRunning || cloudSubject.isRunning,
            };
          });
          const localOnlySubjects = localSubjects.filter(localSubject =>
            !cloudSubjects.some(cloudSubject =>
              cloudSubject.id === localSubject.id || cloudSubject.name === localSubject.name
            )
          );

          setSubjects(mergedSubjects);
          setCurrentSubjectId(mergedSubjects[0].id);

          Promise.all([
            ...mergedSubjects.map(subject =>
              supabase
                .from('timer_subjects')
                .update({
                  name: subject.name,
                  seconds: subject.seconds,
                  is_running: subject.isRunning,
                })
                .eq('id', subject.id)
            ),
            ...(localOnlySubjects.length > 0
              ? [supabase
                .from('timer_subjects')
                .insert(localOnlySubjects.map(subject => ({
                  name: subject.name,
                  seconds: subject.seconds,
                  is_running: subject.isRunning,
                })))]
              : []),
          ])
            .then(results => {
              if (results.some(result => result.error)) setCloudSyncEnabled(false);
            })
            .catch(() => setCloudSyncEnabled(false));
        } else {
          // Try to migrate from localStorage (old app data)
          const oldData = readStorage('timerSubjects');
          const migrated = readStorage('timerSubjects_migrated');
          if (oldData && !migrated) {
            try {
              const oldSubjects: TimerSubject[] = JSON.parse(oldData);
              if (oldSubjects.length > 0) {
                const insertData = oldSubjects.map(s => ({
                  name: s.name,
                  seconds: s.seconds,
                  is_running: s.isRunning,
                }));
                const { data: inserted, error: insertError } = await supabase
                  .from('timer_subjects')
                  .insert(insertData)
                  .select();

                if (insertError) throw insertError;

                const mapped = (inserted as TimerSubjectRow[]).map((s) => ({
                  id: s.id,
                  name: s.name,
                  seconds: s.seconds,
                  isRunning: s.is_running,
                }));
                setSubjects(mapped);
                setCurrentSubjectId(mapped[0].id);
                writeStorage('timerSubjects_migrated', 'true');
                setLoading(false);
                return;
              }
            } catch {
              // Ignore parse errors, fall through to create default
            }
          }

          const { data: newData, error: newError } = await supabase
            .from('timer_subjects')
            .insert({ name: 'General', seconds: 0, is_running: false })
            .select()
            .single();

          if (newError) throw newError;

          const defaultSubject: TimerSubject = {
            id: newData.id,
            name: newData.name,
            seconds: newData.seconds,
            isRunning: newData.is_running,
          };
          setSubjects([defaultSubject]);
          setCurrentSubjectId(defaultSubject.id);
        }
      } catch {
        const localSubjects = loadLocalSubjects();
        setSubjects(localSubjects);
        setCurrentSubjectId(localSubjects[0].id);
        setCloudSyncEnabled(false);
      } finally {
        setLoading(false);
      }
    }

    loadSubjects();
  }, []);

  // Keep a local backup so the timer remains usable if cloud sync is unavailable.
  useEffect(() => {
    if (loading || subjects.length === 0) return;
    writeStorage('timerSubjects', JSON.stringify(subjects));
  }, [loading, subjects]);

  // Timer tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSubjects(prevSubjects =>
        prevSubjects.map(subject =>
          subject.isRunning ? { ...subject, seconds: subject.seconds + 1 } : subject
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Periodic sync to Supabase (every 5 seconds for running subjects)
  useEffect(() => {
    if (!cloudSyncEnabled) return;

    const interval = setInterval(() => {
      const running = subjectsRef.current.filter(s => s.isRunning);
      if (running.length === 0) return;
      Promise.all(
        running.map(s =>
          supabase
            .from('timer_subjects')
            .update({ seconds: s.seconds, is_running: s.isRunning })
            .eq('id', s.id)
        )
      )
        .then(results => {
          if (results.some(result => result.error)) setCloudSyncEnabled(false);
        })
        .catch(() => setCloudSyncEnabled(false));
    }, 5000);

    return () => clearInterval(interval);
  }, [cloudSyncEnabled]);

  // Theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      writeStorage('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      writeStorage('theme', 'light');
    }
  }, [isDark]);

  const handleToggle = useCallback(async () => {
    let updatedSubject: TimerSubject | null = null;

    setSubjects(prev =>
      prev.map(s => {
        if (s.id === currentSubjectId) {
          updatedSubject = { ...s, isRunning: !s.isRunning };
          return updatedSubject;
        }
        return s;
      })
    );

    if (updatedSubject && cloudSyncEnabled) {
      const { error } = await supabase
        .from('timer_subjects')
        .update({ seconds: updatedSubject.seconds, is_running: updatedSubject.isRunning })
        .eq('id', currentSubjectId);
      if (error) setCloudSyncEnabled(false);
    }
  }, [cloudSyncEnabled, currentSubjectId]);

  const handleReset = useCallback(async () => {
    setSubjects(prev =>
      prev.map(s =>
        s.id === currentSubjectId ? { ...s, seconds: 0, isRunning: false } : s
      )
    );

    if (cloudSyncEnabled) {
      const { error } = await supabase
        .from('timer_subjects')
        .update({ seconds: 0, is_running: false })
        .eq('id', currentSubjectId);
      if (error) setCloudSyncEnabled(false);
    }
  }, [cloudSyncEnabled, currentSubjectId]);

  const handleToggleRef = useRef(handleToggle);
  handleToggleRef.current = handleToggle;
  const handleResetRef = useRef(handleReset);
  handleResetRef.current = handleReset;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleRef.current();
      } else if (e.code === 'KeyR') {
        handleResetRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const currentSubject = subjects.find(s => s.id === currentSubjectId) || subjects[0];

  const handleSetTime = useCallback(async () => {
    if (!currentSubject) return;

    const input = prompt(
      `Set elapsed time for "${currentSubject.name}". Use HH:MM:SS, MM:SS, or total seconds.`,
      formatTime(currentSubject.seconds)
    );

    if (input === null) return;

    const nextSeconds = parseManualTime(input);
    if (nextSeconds === null) {
      alert('Invalid time. Please use HH:MM:SS, MM:SS, or total seconds.');
      return;
    }

    setSubjects(prev =>
      prev.map(s =>
        s.id === currentSubject.id ? { ...s, seconds: nextSeconds } : s
      )
    );

    if (cloudSyncEnabled) {
      const { error } = await supabase
        .from('timer_subjects')
        .update({ seconds: nextSeconds })
        .eq('id', currentSubject.id);
      if (error) setCloudSyncEnabled(false);
    }
  }, [cloudSyncEnabled, currentSubject]);

  const handleNewSubject = async () => {
    const name = prompt('Enter subject name:');
    if (!name) return;

    if (!cloudSyncEnabled) {
      const localSubject: TimerSubject = {
        id: generateId(),
        name,
        seconds: 0,
        isRunning: false,
      };
      setSubjects(prev => [...prev, localSubject]);
      setCurrentSubjectId(localSubject.id);
      return;
    }

    const { data, error } = await supabase
      .from('timer_subjects')
      .insert({ name, seconds: 0, is_running: false })
      .select()
      .single();

    if (error) {
      setCloudSyncEnabled(false);
      const localSubject: TimerSubject = {
        id: generateId(),
        name,
        seconds: 0,
        isRunning: false,
      };
      setSubjects(prev => [...prev, localSubject]);
      setCurrentSubjectId(localSubject.id);
      return;
    }

    const newSubject: TimerSubject = {
      id: data.id,
      name: data.name,
      seconds: data.seconds,
      isRunning: data.is_running,
    };

    setSubjects(prev => [...prev, newSubject]);
    setCurrentSubjectId(newSubject.id);
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (subjects.length <= 1) {
      alert('Cannot delete the last subject!');
      return;
    }

    if (confirm('Are you sure you want to delete this subject?')) {
      if (cloudSyncEnabled) {
        const { error } = await supabase.from('timer_subjects').delete().eq('id', subjectId);
        if (error) {
          setCloudSyncEnabled(false);
        }
      }

      setSubjects(prev => prev.filter(s => s.id !== subjectId));
      if (currentSubjectId === subjectId) {
        const remaining = subjects.filter(s => s.id !== subjectId);
        setCurrentSubjectId(remaining[0]?.id || '');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-300 text-lg">Loading...</div>
      </div>
    );
  }

  if (!currentSubject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-300 text-lg">Preparing timer...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-800 dark:text-gray-100">
            {currentSubject?.name || 'Timer'}
          </h1>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <Timer subject={currentSubject} />
            <Controls
              currentSubject={currentSubject}
              onToggle={handleToggle}
              onReset={handleReset}
              onNewSubject={handleNewSubject}
              onSetTime={handleSetTime}
            />
            <TimerInfo
              subjects={subjects}
              currentSubject={currentSubject}
              onSelectSubject={(subject) => setCurrentSubjectId(subject.id)}
              onDeleteSubject={handleDeleteSubject}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
