import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useUser } from '../context/UserContext';
import { formatMinutes, toDateStr, getPeriodStart } from '../lib/schedule';

const fetcher = url => fetch(url).then(r => r.json());
const TODAY   = toDateStr();

// ── Alvin-only: lesson tab ────────────────────────────────────────────────────

function LessonTab({ subject, total }) {
  const { data: lessons } = useSWR(`/tracker/api/lessons/${subject}`, fetcher);
  const { data: summary } = useSWR(`/tracker/api/summary?user_id=alvin`, fetcher);

  const completedCount = lessons?.filter(l => l.completed).length ?? 0;
  const totalMins = summary?.timeTotals?.find(t => t.subject === subject)?.total_minutes ?? 0;
  const weeksLeft = Math.max(1, 14 - Math.floor(
    (Date.now() - new Date('2026-04-05').getTime()) / (7 * 86400000)
  ));
  const pace = Math.ceil((total - completedCount) / weeksLeft);
  const pct  = Math.round((completedCount / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-gray-400">
        <span>⏱ {formatMinutes(totalMins)} total</span>
        <span>~{pace}/week to finish</span>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{completedCount} / {total} lessons</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {lessons?.map(l => (
          <button
            key={l.lesson_number}
            onClick={async () => {
              await fetch(`/tracker/api/lessons/${subject}/${l.lesson_number}`, { method: 'PATCH' });
              mutate(`/tracker/api/lessons/${subject}`);
              mutate('/tracker/api/summary?user_id=alvin');
            }}
            className={`aspect-square rounded text-xs flex items-center justify-center transition-colors ${
              l.completed ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {l.lesson_number}
          </button>
        ))}
      </div>
    </div>
  );
}

function GymPianoTab() {
  const { data: summary } = useSWR('/tracker/api/summary?user_id=alvin', fetcher);
  const pianoMins = summary?.timeTotals?.find(t => t.subject === 'piano')?.total_minutes ?? 0;
  const gymMins   = summary?.timeTotals?.find(t => t.subject === 'gym')?.total_minutes   ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <h3 className="font-medium">🏋 Gym</h3>
        <div className="text-gray-300 text-sm">Total visits: {summary?.gymVisits ?? 0}</div>
        <div className="text-gray-300 text-sm">Streak: {summary?.gymStreak ?? 0} days</div>
        {gymMins > 0 && <div className="text-gray-400 text-sm">⏱ {formatMinutes(gymMins)} logged</div>}
      </div>
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <h3 className="font-medium">🎹 Piano</h3>
        <div className="text-gray-300 text-sm">⏱ {formatMinutes(pianoMins)} total</div>
      </div>
    </div>
  );
}

// ── Task progress (all users) ─────────────────────────────────────────────────

function TaskProgress({ userId }) {
  const { data: tasks   = [] } = useSWR(`/tracker/api/tasks?user_id=${userId}`, fetcher);
  const logsFrom = TODAY.slice(0, 7) + '-01';
  const { data: logs = [] } = useSWR(
    `/tracker/api/task-logs?user_id=${userId}&from=${logsFrom}&to=${TODAY}`,
    fetcher
  );

  if (tasks.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-6">No tasks assigned yet.</p>;
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => {
        const periodStart = task.frequency_period
          ? getPeriodStart(task.frequency_period, TODAY)
          : task.time_period
          ? getPeriodStart(task.time_period, TODAY)
          : TODAY;

        const periodLogs = logs.filter(l => l.task_id === task.id && l.date >= periodStart);

        let progress = null;
        if (task.type === 'frequency') {
          const count = periodLogs.length;
          const pct = Math.min(100, Math.round((count / task.frequency_count) * 100));
          progress = (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{count}/{task.frequency_count}× this {task.frequency_period}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        } else if (task.type === 'time') {
          const mins = periodLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
          const pct  = Math.min(100, Math.round((mins / task.target_minutes) * 100));
          progress = (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatMinutes(mins)} / {formatMinutes(task.target_minutes)} this {task.time_period}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        } else if (task.type === 'deadline') {
          const done = logs.some(l => l.task_id === task.id);
          progress = (
            <div className="text-xs text-gray-400">
              {done
                ? <span className="text-green-400">✓ Completed</span>
                : task.due_date
                ? <span className={task.due_date < TODAY ? 'text-red-400' : ''}>Due {task.due_date}</span>
                : <span>Not yet done</span>
              }
            </div>
          );
        }

        const TYPE_BADGE = { deadline: 'bg-orange-900 text-orange-300', frequency: 'bg-purple-900 text-purple-300', time: 'bg-blue-900 text-blue-300' };

        return (
          <div key={task.id} className="bg-gray-900 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_BADGE[task.type]}`}>{task.type}</span>
              <span className="text-sm font-medium text-gray-100">{task.title}</span>
            </div>
            {progress}
          </div>
        );
      })}
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

const ALVIN_TABS = [
  { id: 'french',   label: '🇫🇷 French' },
  { id: 'japanese', label: '🇯🇵 Japanese' },
  { id: 'gym',      label: '🏋 Gym & Piano' },
];

export default function ProgressScreen() {
  const { user } = useUser();
  const [tab, setTab] = useState('french');
  const isAlvin = user?.id === 'alvin';

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">Progress</h1>

      {/* Alvin's detailed tracking */}
      {isAlvin && (
        <>
          <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
            {ALVIN_TABS.map(t => (
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
          <hr className="border-gray-800" />
        </>
      )}

      {/* Tasks for everyone */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task Progress</h2>
        {user && <TaskProgress userId={user.id} />}
      </div>
    </div>
  );
}
