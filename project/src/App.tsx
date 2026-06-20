import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Timer } from './components/Timer';
import { Controls } from './components/Controls';
import { TimerInfo } from './components/TimerInfo';
import { ThemeToggle } from './components/ThemeToggle';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { TimerSubject } from './utils/timeUtils';

function App() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [subjects, setSubjects] = useState<TimerSubject[]>([]);
  const [currentSubjectId, setCurrentSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subjectsRef = useRef(subjects);
  subjectsRef.current = subjects;

  // Fetch from Supabase on mount, with localStorage migration
  useEffect(() => {
    async function loadSubjects() {
      if (!isSupabaseConfigured) {
        setError('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment settings.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('timer_subjects')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const mapped = data.map((s: any) => ({
            id: s.id,
            name: s.name,
            seconds: s.seconds,
            isRunning: s.is_running,
          }));
          setSubjects(mapped);
          setCurrentSubjectId(mapped[0].id);
        } else {
          // Try to migrate from localStorage (old app data)
          const oldData = localStorage.getItem('timerSubjects');
          const migrated = localStorage.getItem('timerSubjects_migrated');
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

                const mapped = inserted!.map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  seconds: s.seconds,
                  isRunning: s.is_running,
                }));
                setSubjects(mapped);
                setCurrentSubjectId(mapped[0].id);
                localStorage.setItem('timerSubjects_migrated', 'true');
                setLoading(false);
                return;
              }
            } catch (e) {
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
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadSubjects();
  }, []);

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
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
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

    if (updatedSubject) {
      const { error } = await supabase
        .from('timer_subjects')
        .update({ seconds: updatedSubject.seconds, is_running: updatedSubject.isRunning })
        .eq('id', currentSubjectId);
      if (error) setError(error.message);
    }
  }, [currentSubjectId]);

  const handleReset = useCallback(async () => {
    setSubjects(prev =>
      prev.map(s =>
        s.id === currentSubjectId ? { ...s, seconds: 0, isRunning: false } : s
      )
    );

    const { error } = await supabase
      .from('timer_subjects')
      .update({ seconds: 0, is_running: false })
      .eq('id', currentSubjectId);
    if (error) setError(error.message);
  }, [currentSubjectId]);

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

  const handleNewSubject = async () => {
    const name = prompt('Enter subject name:');
    if (name) {
      const { data, error } = await supabase
        .from('timer_subjects')
        .insert({ name, seconds: 0, is_running: false })
        .select()
        .single();

      if (error) {
        setError(error.message);
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
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (subjects.length <= 1) {
      alert('Cannot delete the last subject!');
      return;
    }

    if (confirm('Are you sure you want to delete this subject?')) {
      const { error } = await supabase.from('timer_subjects').delete().eq('id', subjectId);
      if (error) {
        setError(error.message);
        return;
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">Error: {error}</div>
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
