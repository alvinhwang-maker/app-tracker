import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { formatMinutes } from '../lib/schedule';

const fetcher = url => fetch(url).then(r => r.json());

// 13-week start
const START = new Date('2026-04-05T00:00:00');
function weeksElapsed() {
  return Math.max(1, Math.floor((Date.now() - START.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

async function toggleLesson(subject, number) {
  await fetch(`/tracker/api/lessons/${subject}/${number}`, { method: 'PATCH' });
  mutate(`/tracker/api/lessons/${subject}`);
  mutate('/tracker/api/summary');
}

// ── Lesson tab ────────────────────────────────────────────────────────────────

function LessonTab({ subject, total }) {
  const { data: lessons } = useSWR(`/tracker/api/lessons/${subject}`, fetcher);
  const { data: summary } = useSWR('/tracker/api/summary', fetcher);

  const completedCount = lessons?.filter(l => l.completed).length ?? 0;
  const totalMins = summary?.timeTotals?.find(t => t.subject === subject)?.total_minutes ?? 0;
  const weeksLeft = Math.max(1, 13 - weeksElapsed() + 1);
  const remainingLessons = total - completedCount;
  const pace = Math.ceil(remainingLessons / weeksLeft);
  const pct = Math.round((completedCount / total) * 100);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex justify-between text-sm text-gray-400">
        <span>⏱ {formatMinutes(totalMins)} total</span>
        <span>~{pace}/week to finish</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{completedCount} / {total} lessons</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lesson grid */}
      <div className="grid grid-cols-7 gap-1">
        {lessons?.map(l => (
          <button
            key={l.lesson_number}
            onClick={() => toggleLesson(subject, l.lesson_number)}
            className={`aspect-square rounded text-xs flex items-center justify-center transition-colors ${
              l.completed
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {l.lesson_number}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Gym & Piano tab ───────────────────────────────────────────────────────────

function GymPianoTab() {
  const { data: summary } = useSWR('/tracker/api/summary', fetcher);
  const pianoMins = summary?.timeTotals?.find(t => t.subject === 'piano')?.total_minutes ?? 0;
  const gymMins   = summary?.timeTotals?.find(t => t.subject === 'gym')?.total_minutes ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <h3 className="font-medium">🏋 Gym</h3>
        <div className="text-gray-300 text-sm">Total visits: {summary?.gymVisits ?? 0}</div>
        <div className="text-gray-300 text-sm">Current streak: {summary?.gymStreak ?? 0} days</div>
        {gymMins > 0 && <div className="text-gray-400 text-sm">⏱ {formatMinutes(gymMins)} logged</div>}
      </div>
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <h3 className="font-medium">🎹 Piano</h3>
        <div className="text-gray-300 text-sm">⏱ {formatMinutes(pianoMins)} total</div>
      </div>
    </div>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'french',   label: '🇫🇷 French' },
  { id: 'japanese', label: '🇯🇵 Japanese' },
  { id: 'gym',      label: '🏋 Gym & Piano' },
];

export default function ProgressScreen() {
  const [tab, setTab] = useState('french');

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">Progress</h1>

      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'french'   && <LessonTab subject="french"   total={54} />}
      {tab === 'japanese' && <LessonTab subject="japanese" total={25} />}
      {tab === 'gym'      && <GymPianoTab />}
    </div>
  );
}
