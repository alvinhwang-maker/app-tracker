import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useUser } from '../context/UserContext';
import TaskSection from './TaskSection';
import {
  getScheduleForDate, formatMinutes, toDateStr, currentWeek, SUBJECT_CONFIG, getPeriodStart,
} from '../lib/schedule';

const TODAY = toDateStr();
const fetcher = url => fetch(url).then(r => r.json());

// ── timer hook ────────────────────────────────────────────────────────────────

function useTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef    = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(
        () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
        1000
      );
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

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

function revalidateSessions(date, userId) {
  mutate(`/tracker/api/sessions?date=${date}&user_id=${userId}`);
}

async function logSession(date, userId, data) {
  await fetch('/tracker/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, user_id: userId, ...data }),
  });
  revalidateSessions(date, userId);
}

async function deleteSession(id, date, userId) {
  await fetch(`/tracker/api/sessions/${id}`, { method: 'DELETE' });
  revalidateSessions(date, userId);
}

async function toggleLesson(subject, number) {
  await fetch(`/tracker/api/lessons/${subject}/${number}`, { method: 'PATCH' });
  mutate(`/tracker/api/lessons/${subject}`);
  mutate('/tracker/api/summary?user_id=alvin');
}

// ── Gym card ──────────────────────────────────────────────────────────────────

function GymCard({ date, userId, sessions }) {
  const [gymType, setGymType] = useState('self');
  const mine    = sessions?.filter(s => s.subject === 'gym') || [];
  const checkedIn = mine.length > 0;

  return (
    <div className={`rounded-xl p-4 bg-gray-900 ${checkedIn ? 'border border-green-800' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">🏋 Gym</span>
        {checkedIn ? (
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-sm">✓ {mine[0].gym_type}</span>
            <button onClick={() => deleteSession(mine[0].id, date, userId)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
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
              onClick={() => logSession(date, userId, { subject: 'gym', gym_type: gymType })}
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

// ── Study card ────────────────────────────────────────────────────────────────

function StudyCard({ id, date, userId, sessions, lessons, isRetroactive }) {
  const config   = SUBJECT_CONFIG[id];
  const timer    = useTimer();
  const [manual, setManual]       = useState('');
  const [showManual, setShowManual] = useState(isRetroactive);
  const [lessonInput, setLessonInput] = useState('');

  const mine      = sessions?.filter(s => s.subject === id) || [];
  const totalMins = mine.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const nextLesson = lessons?.find(l => !l.completed)?.lesson_number;

  async function handleStop() {
    const mins = timer.stop();
    await logSession(date, userId, { subject: id, duration_minutes: mins });
    timer.reset();
  }

  async function handleManual() {
    const mins = parseInt(manual, 10);
    if (!mins || mins <= 0) return;
    await logSession(date, userId, { subject: id, duration_minutes: mins });
    setManual('');
    if (!isRetroactive) setShowManual(false);
  }

  async function handleLessonMark() {
    const num = parseInt(lessonInput, 10);
    if (!num) return;
    await toggleLesson(id, num);
    setLessonInput('');
  }

  return (
    <div className={`rounded-xl p-4 bg-gray-900 ${mine.length > 0 ? 'border border-gray-700' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">{config.icon} {config.label}</span>
        <span className="text-gray-400 text-sm">{formatMinutes(totalMins)}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {!isRetroactive && !timer.running && (
          <button onClick={timer.start} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg">
            ▶ Start
          </button>
        )}
        {timer.running && (
          <>
            <span className="font-mono text-blue-300 text-sm w-14">{fmt(timer.elapsed)}</span>
            <button onClick={handleStop} className="bg-red-700 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg">
              ⏹ Stop
            </button>
          </>
        )}
        {!isRetroactive && !timer.running && (
          <button onClick={() => setShowManual(v => !v)} className="text-gray-500 hover:text-gray-300 text-xs">
            + manual
          </button>
        )}
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

      {(showManual || isRetroactive) && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            value={manual}
            onChange={e => setManual(e.target.value)}
            placeholder="minutes"
            className="w-24 bg-gray-800 text-sm rounded px-2 py-1 text-gray-100 placeholder-gray-600"
          />
          <button onClick={handleManual} className="text-blue-400 hover:text-blue-300 text-sm">Log</button>
          {!isRetroactive && <button onClick={() => setShowManual(false)} className="text-gray-600 text-xs">cancel</button>}
        </div>
      )}

      {mine.length > 0 && (
        <div className="mt-3 border-t border-gray-800 pt-2 space-y-1">
          {mine.map(s => (
            <div key={s.id} className="flex justify-between text-xs text-gray-400">
              <span>+{s.duration_minutes}m</span>
              <button onClick={() => deleteSession(s.id, date, userId)} className="hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TodayScreen ───────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user } = useUser();
  const [date, setDate] = useState(TODAY);
  const isRetroactive   = date !== TODAY;
  const isAlvin         = user?.id === 'alvin';

  const schedule = getScheduleForDate(date);
  const sessionKey = user ? `/tracker/api/sessions?date=${date}&user_id=${user.id}` : null;
  const { data: sessions } = useSWR(sessionKey, fetcher);

  // Lessons (Alvin only)
  const { data: frenchLessons }   = useSWR(isAlvin ? '/tracker/api/lessons/french'   : null, fetcher);
  const { data: japaneseLessons } = useSWR(isAlvin ? '/tracker/api/lessons/japanese' : null, fetcher);

  // Tasks
  const taskKey = user ? `/tracker/api/tasks?user_id=${user.id}` : null;
  const { data: tasks } = useSWR(taskKey, fetcher);

  // Task logs — fetch from start of month
  const logsFrom = date.slice(0, 7) + '-01';
  const taskLogKey = user ? `/tracker/api/task-logs?user_id=${user.id}&from=${logsFrom}&to=${date}` : null;
  const { data: taskLogs = [] } = useSWR(taskLogKey, fetcher);

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold flex-1">{dateLabel}</h1>
          <input
            type="date"
            value={date}
            max={TODAY}
            onChange={e => setDate(e.target.value || TODAY)}
            className="bg-gray-800 text-xs text-gray-300 rounded px-2 py-1 border border-gray-700"
          />
        </div>
        {isAlvin && !isRetroactive && (
          <p className="text-gray-500 text-sm">Week {currentWeek()} of 13</p>
        )}
      </div>

      {/* Retroactive banner */}
      {isRetroactive && (
        <div className="bg-amber-950 border border-amber-700 rounded-xl px-3 py-2 text-amber-300 text-xs flex items-center gap-2">
          <span>⚠</span>
          <span>Logging for a past date — these entries will be flagged for admin review.</span>
        </div>
      )}

      {/* Alvin's practice tracking */}
      {isAlvin && schedule.length > 0 && (
        <div className="space-y-3">
          {schedule.map(subject =>
            subject.isGym ? (
              <GymCard key="gym" date={date} userId={user.id} sessions={sessions} />
            ) : (
              <StudyCard
                key={subject.id}
                id={subject.id}
                date={date}
                userId={user.id}
                sessions={sessions}
                lessons={
                  subject.id === 'french'   ? frenchLessons :
                  subject.id === 'japanese' ? japaneseLessons : null
                }
                isRetroactive={isRetroactive}
              />
            )
          )}
        </div>
      )}

      {isAlvin && schedule.length === 0 && !tasks?.length && (
        <p className="text-gray-600 text-center py-6 text-sm">No scheduled activities today.</p>
      )}

      {/* Tasks for all users */}
      {user && (
        <TaskSection
          userId={user.id}
          date={date}
          tasks={tasks}
          logs={taskLogs}
          logsFrom={logsFrom}
          isRetroactive={isRetroactive}
        />
      )}
    </div>
  );
}
