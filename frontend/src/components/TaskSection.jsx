import { useState, useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { formatMinutes, getPeriodStart } from '../lib/schedule';

// ── helpers ───────────────────────────────────────────────────────────────────

async function postLog(body) {
  await fetch('/tracker/api/task-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function deleteLog(id) {
  await fetch(`/tracker/api/task-logs/${id}`, { method: 'DELETE' });
}

function revalidate(userId, logsFrom, date) {
  mutate(`/tracker/api/task-logs?user_id=${userId}&from=${logsFrom}&to=${date}`);
}

// ── Deadline task ─────────────────────────────────────────────────────────────

function DeadlineTask({ task, logs, date, userId, logsFrom }) {
  const todayLog = logs.find(l => l.task_id === task.id && l.date === date);
  const done = !!todayLog;
  const overdue = task.due_date && task.due_date < date && !done;

  async function toggle() {
    if (done) {
      await deleteLog(todayLog.id);
    } else {
      await postLog({ task_id: task.id, user_id: userId, date });
    }
    revalidate(userId, logsFrom, date);
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl bg-gray-900 ${done ? 'opacity-60' : ''}`}>
      <button
        onClick={toggle}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          done ? 'bg-green-600 border-green-600' : overdue ? 'border-red-500' : 'border-gray-600 hover:border-gray-400'
        }`}
      >
        {done && <span className="text-white text-xs leading-none">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${done ? 'line-through text-gray-500' : 'text-gray-100'}`}>
          {task.title}
        </span>
        {task.due_date && (
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
            overdue ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400'
          }`}>
            {overdue ? '⚠ overdue' : `due ${task.due_date}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Frequency task ────────────────────────────────────────────────────────────

function FrequencyTask({ task, logs, date, userId, logsFrom }) {
  const periodStart = getPeriodStart(task.frequency_period, date);
  const periodLogs  = logs.filter(l => l.task_id === task.id && l.date >= periodStart && l.date <= date);
  const count  = periodLogs.length;
  const target = task.frequency_count;
  const done   = count >= target;

  async function add() {
    await postLog({ task_id: task.id, user_id: userId, date });
    revalidate(userId, logsFrom, date);
  }

  async function remove() {
    const last = [...periodLogs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!last) return;
    await deleteLog(last.id);
    revalidate(userId, logsFrom, date);
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl bg-gray-900 ${done ? 'border border-green-900' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        done ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'
      }`}>
        {count}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-100">{task.title}</div>
        <div className="text-xs text-gray-500">{count}/{target}× this {task.frequency_period}</div>
      </div>
      <div className="flex gap-1 items-center">
        {count > 0 && (
          <button onClick={remove} className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm flex items-center justify-center">
            −
          </button>
        )}
        <button onClick={add} className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm flex items-center justify-center">
          +
        </button>
      </div>
    </div>
  );
}

// ── Time task ─────────────────────────────────────────────────────────────────

function TimeTask({ task, logs, date, userId, logsFrom, isRetroactive }) {
  const periodStart = getPeriodStart(task.time_period, date);
  const periodLogs  = logs.filter(l => l.task_id === task.id && l.date >= periodStart && l.date <= date);
  const todayLogs   = logs.filter(l => l.task_id === task.id && l.date === date);
  const totalMins   = periodLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const todayMins   = todayLogs.reduce((s, l)  => s + (l.duration_minutes || 0), 0);
  const target      = task.target_minutes;
  const pct         = Math.min(100, Math.round((totalMins / target) * 100));
  const done        = totalMins >= target;

  const [manual, setManual] = useState('');

  // Simple timer (hidden in retroactive mode)
  const [running, setRunning]   = useState(false);
  const [elapsed, setElapsed]   = useState(0);
  const startRef   = useRef(null);
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

  async function handleStop() {
    setRunning(false);
    const mins = Math.max(1, Math.ceil(elapsed / 60));
    setElapsed(0);
    await postLog({ task_id: task.id, user_id: userId, date, duration_minutes: mins });
    revalidate(userId, logsFrom, date);
  }

  async function handleManual() {
    const mins = parseInt(manual, 10);
    if (!mins || mins <= 0) return;
    await postLog({ task_id: task.id, user_id: userId, date, duration_minutes: mins });
    setManual('');
    revalidate(userId, logsFrom, date);
  }

  async function removeLog(id) {
    await deleteLog(id);
    revalidate(userId, logsFrom, date);
  }

  const fmtElapsed = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className={`p-3 rounded-xl bg-gray-900 space-y-2 ${done ? 'border border-green-900' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-100">{task.title}</span>
        <span className="text-xs text-gray-400">{formatMinutes(todayMins)} today · {formatMinutes(totalMins)}/{formatMinutes(target)} {task.time_period}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isRetroactive && !running && (
          <button onClick={() => setRunning(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">
            ▶ Start
          </button>
        )}
        {running && (
          <>
            <span className="font-mono text-blue-300 text-xs">{fmtElapsed}</span>
            <button onClick={handleStop} className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg">
              ⏹ Stop
            </button>
          </>
        )}
        <input
          type="number"
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="mins"
          className="w-16 bg-gray-800 text-xs rounded px-2 py-1.5 text-gray-100 placeholder-gray-600"
        />
        <button onClick={handleManual} className="text-blue-400 hover:text-blue-300 text-xs">Log</button>
      </div>

      {/* Today's logs */}
      {todayLogs.length > 0 && (
        <div className="border-t border-gray-800 pt-2 space-y-1">
          {todayLogs.map(l => (
            <div key={l.id} className="flex justify-between text-xs text-gray-500">
              <span>+{l.duration_minutes}m</span>
              <button onClick={() => removeLog(l.id)} className="hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TaskSection ───────────────────────────────────────────────────────────────

export default function TaskSection({ userId, date, tasks, logs, logsFrom, isRetroactive }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</h2>
        <p className="text-gray-600 text-sm text-center py-4">No tasks assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</h2>
      {tasks.map(task => {
        const props = { key: task.id, task, logs, date, userId, logsFrom, isRetroactive };
        if (task.type === 'deadline')  return <DeadlineTask  {...props} />;
        if (task.type === 'frequency') return <FrequencyTask {...props} />;
        if (task.type === 'time')      return <TimeTask      {...props} />;
        return null;
      })}
    </div>
  );
}
