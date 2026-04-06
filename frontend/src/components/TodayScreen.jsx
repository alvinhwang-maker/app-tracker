import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { getTodaySchedule, formatMinutes, toDateStr, currentWeek, SUBJECT_CONFIG } from '../lib/schedule';

const TODAY = toDateStr();
const fetcher = url => fetch(url).then(r => r.json());

function useTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => setRunning(true);
  const stop  = () => { setRunning(false); return Math.max(1, Math.ceil(elapsed / 60)); };
  const reset = () => { setRunning(false); setElapsed(0); };

  return { running, elapsed, start, stop, reset };
}

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function logSession(data) {
  await fetch('/tracker/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: TODAY, ...data }),
  });
  mutate(`/tracker/api/sessions?date=${TODAY}`);
}

async function deleteSession(id) {
  await fetch(`/tracker/api/sessions/${id}`, { method: 'DELETE' });
  mutate(`/tracker/api/sessions?date=${TODAY}`);
}

async function toggleLesson(subject, number) {
  await fetch(`/tracker/api/lessons/${subject}/${number}`, { method: 'PATCH' });
  mutate(`/tracker/api/lessons/${subject}`);
  mutate('/tracker/api/summary');
}

// ── Gym card ──────────────────────────────────────────────────────────────────

function GymCard({ sessions }) {
  const [gymType, setGymType] = useState('self');
  const gymSessions = sessions?.filter(s => s.subject === 'gym') || [];
  const checkedIn = gymSessions.length > 0;

  return (
    <div className={`rounded-xl p-4 ${checkedIn ? 'bg-gray-900 border border-green-800' : 'bg-gray-900'}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">🏋 Gym</span>
        {checkedIn ? (
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-sm">✓ {gymSessions[0].gym_type}</span>
            <button onClick={() => deleteSession(gymSessions[0].id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGymType(g => g === 'self' ? 'coach' : 'self')}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-300"
            >
              {gymType}
            </button>
            <button
              onClick={() => logSession({ subject: 'gym', gym_type: gymType })}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg"
            >
              Check in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Study card (French, Japanese, Piano) ──────────────────────────────────────

function StudyCard({ id, sessions, lessons }) {
  const config = SUBJECT_CONFIG[id];
  const timer = useTimer();
  const [manualMins, setManualMins] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [lessonInput, setLessonInput] = useState('');

  const mySessions = sessions?.filter(s => s.subject === id) || [];
  const totalMins = mySessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const nextLesson = lessons?.find(l => !l.completed)?.lesson_number;

  async function handleStop() {
    const mins = timer.stop();
    await logSession({ subject: id, duration_minutes: mins });
    timer.reset();
  }

  async function handleManual() {
    const mins = parseInt(manualMins, 10);
    if (!mins || mins <= 0) return;
    await logSession({ subject: id, duration_minutes: mins });
    setManualMins('');
    setShowManual(false);
  }

  async function handleLessonMark() {
    const num = parseInt(lessonInput, 10);
    if (!num) return;
    await toggleLesson(id, num);
    setLessonInput('');
  }

  return (
    <div className={`rounded-xl p-4 bg-gray-900 ${mySessions.length > 0 ? 'border border-gray-700' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">{config.icon} {config.label}</span>
        <span className="text-gray-400 text-sm">{formatMinutes(totalMins)}</span>
      </div>

      {/* Timer row */}
      <div className="flex items-center gap-2 flex-wrap">
        {!timer.running ? (
          <button onClick={timer.start} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg">
            ▶ Start
          </button>
        ) : (
          <>
            <span className="font-mono text-blue-300 text-sm w-14">{fmt(timer.elapsed)}</span>
            <button onClick={handleStop} className="bg-red-700 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg">
              ⏹ Stop
            </button>
          </>
        )}

        <button
          onClick={() => setShowManual(v => !v)}
          className="text-gray-500 hover:text-gray-300 text-xs"
        >
          + manual
        </button>

        {/* Lesson marker (French / Japanese only) */}
        {config.hasLessons && (
          <div className="flex items-center gap-1 ml-auto">
            {nextLesson && <span className="text-gray-500 text-xs">next: {nextLesson}</span>}
            <input
              type="number"
              value={lessonInput}
              onChange={e => setLessonInput(e.target.value)}
              placeholder="L#"
              className="w-14 bg-gray-800 text-center text-sm rounded px-1 py-1 text-gray-100 placeholder-gray-600"
            />
            <button onClick={handleLessonMark} className="text-green-400 hover:text-green-300 text-sm font-bold">✓</button>
          </div>
        )}
      </div>

      {/* Manual entry */}
      {showManual && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            value={manualMins}
            onChange={e => setManualMins(e.target.value)}
            placeholder="minutes"
            className="w-24 bg-gray-800 text-sm rounded px-2 py-1 text-gray-100 placeholder-gray-600"
          />
          <button onClick={handleManual} className="text-blue-400 hover:text-blue-300 text-sm">Log</button>
          <button onClick={() => setShowManual(false)} className="text-gray-600 hover:text-gray-400 text-xs">cancel</button>
        </div>
      )}

      {/* Logged sessions */}
      {mySessions.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-gray-800 pt-2">
          {mySessions.map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs text-gray-400">
              <span>+{s.duration_minutes}m</span>
              <button onClick={() => deleteSession(s.id)} className="hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const schedule = getTodaySchedule();
  const { data: sessions } = useSWR(`/tracker/api/sessions?date=${TODAY}`, fetcher);
  const { data: frenchLessons }   = useSWR('/tracker/api/lessons/french', fetcher);
  const { data: japaneseLessons } = useSWR('/tracker/api/lessons/japanese', fetcher);

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="p-4 space-y-3">
      <div className="pt-2 pb-1">
        <h1 className="text-xl font-bold">{dateLabel}</h1>
        <p className="text-gray-500 text-sm">Week {currentWeek()} of 13</p>
      </div>

      {schedule.length === 0 ? (
        <p className="text-gray-600 text-center py-12">No scheduled activities today.</p>
      ) : (
        schedule.map(subject =>
          subject.isGym ? (
            <GymCard key="gym" sessions={sessions} />
          ) : (
            <StudyCard
              key={subject.id}
              id={subject.id}
              sessions={sessions}
              lessons={
                subject.id === 'french'   ? frenchLessons :
                subject.id === 'japanese' ? japaneseLessons :
                null
              }
            />
          )
        )
      )}
    </div>
  );
}
