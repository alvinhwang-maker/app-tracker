import { useState } from 'react';
import useSWR, { mutate } from 'swr';

const fetcher = url => fetch(url).then(r => r.json());
const USERS   = ['alvin', 'adrian', 'hailey'];
const USER_LABELS = { alvin: 'Alvin', adrian: 'Adrian', hailey: 'Hailey' };

// ── helpers ───────────────────────────────────────────────────────────────────

function revalidateTasks()    { mutate('/tracker/api/tasks/all'); USERS.forEach(u => mutate(`/tracker/api/tasks?user_id=${u}`)); }
function revalidateFlagged()  { mutate('/tracker/api/sessions/flagged'); }

// ── Task form ─────────────────────────────────────────────────────────────────

function TaskForm({ initial = {}, targetUser, onSave, onCancel }) {
  const [title,           setTitle]           = useState(initial.title           || '');
  const [description,     setDescription]     = useState(initial.description     || '');
  const [type,            setType]            = useState(initial.type            || 'frequency');
  const [dueDate,         setDueDate]         = useState(initial.due_date        || '');
  const [freqCount,       setFreqCount]       = useState(initial.frequency_count  || 3);
  const [freqPeriod,      setFreqPeriod]      = useState(initial.frequency_period || 'week');
  const [targetMins,      setTargetMins]      = useState(initial.target_minutes   || 30);
  const [timePeriod,      setTimePeriod]      = useState(initial.time_period      || 'day');

  function buildPayload() {
    const base = { title, description: description || null, type, user_id: targetUser, created_by: 'alvin' };
    if (type === 'deadline')  return { ...base, due_date: dueDate || null };
    if (type === 'frequency') return { ...base, frequency_count: Number(freqCount), frequency_period: freqPeriod };
    if (type === 'time')      return { ...base, target_minutes:  Number(targetMins), time_period: timePeriod };
    return base;
  }

  const SEL = 'bg-gray-700 text-gray-100 text-sm rounded px-2 py-1.5';
  const INP = 'bg-gray-700 text-gray-100 text-sm rounded px-2 py-1.5 w-full';

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title"
        className={INP}
      />
      <select value={type} onChange={e => setType(e.target.value)} className={SEL}>
        <option value="frequency">Frequency  (X times per period)</option>
        <option value="time">Time  (X minutes per period)</option>
        <option value="deadline">Deadline  (by a date)</option>
      </select>

      {type === 'deadline' && (
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INP} />
      )}
      {type === 'frequency' && (
        <div className="flex gap-2">
          <input type="number" min="1" value={freqCount} onChange={e => setFreqCount(e.target.value)}
            className="w-20 bg-gray-700 text-gray-100 text-sm rounded px-2 py-1.5" />
          <span className="text-gray-400 text-sm self-center">times per</span>
          <select value={freqPeriod} onChange={e => setFreqPeriod(e.target.value)} className={SEL}>
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </div>
      )}
      {type === 'time' && (
        <div className="flex gap-2">
          <input type="number" min="1" value={targetMins} onChange={e => setTargetMins(e.target.value)}
            className="w-20 bg-gray-700 text-gray-100 text-sm rounded px-2 py-1.5" />
          <span className="text-gray-400 text-sm self-center">minutes per</span>
          <select value={timePeriod} onChange={e => setTimePeriod(e.target.value)} className={SEL}>
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </div>
      )}

      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className={INP}
      />

      <div className="flex gap-2">
        <button
          onClick={() => { if (title.trim()) onSave(buildPayload()); }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded-lg"
        >
          Save
        </button>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
      </div>
    </div>
  );
}

// ── Tasks section ─────────────────────────────────────────────────────────────

function TasksSection() {
  const [activeUser, setActiveUser] = useState('alvin');
  const [showAdd,    setShowAdd]    = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const { data: allTasks = [] } = useSWR('/tracker/api/tasks/all', fetcher);
  const userTasks = allTasks.filter(t => t.user_id === activeUser);

  async function createTask(payload) {
    await fetch('/tracker/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    revalidateTasks();
    setShowAdd(false);
  }

  async function updateTask(id, payload) {
    await fetch(`/tracker/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    revalidateTasks();
    setEditingTask(null);
  }

  async function archiveTask(id) {
    await fetch(`/tracker/api/tasks/${id}`, { method: 'DELETE' });
    revalidateTasks();
  }

  const TYPE_BADGE = {
    deadline:  'bg-orange-900 text-orange-300',
    frequency: 'bg-purple-900 text-purple-300',
    time:      'bg-blue-900  text-blue-300',
  };

  function taskSummary(t) {
    if (t.type === 'frequency') return `${t.frequency_count}× / ${t.frequency_period}`;
    if (t.type === 'time')      return `${t.target_minutes} min / ${t.time_period}`;
    if (t.type === 'deadline')  return t.due_date ? `due ${t.due_date}` : 'no deadline';
    return '';
  }

  return (
    <div className="space-y-4">
      {/* User tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
        {USERS.map(u => (
          <button
            key={u}
            onClick={() => { setActiveUser(u); setShowAdd(false); setEditingTask(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeUser === u ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {USER_LABELS[u]}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {userTasks.length === 0 && !showAdd && (
          <p className="text-gray-600 text-sm text-center py-3">No tasks yet.</p>
        )}
        {userTasks.map(t => (
          editingTask?.id === t.id ? (
            <TaskForm
              key={t.id}
              initial={t}
              targetUser={activeUser}
              onSave={payload => updateTask(t.id, payload)}
              onCancel={() => setEditingTask(null)}
            />
          ) : (
            <div key={t.id} className="flex items-center gap-2 bg-gray-900 rounded-xl p-3">
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_BADGE[t.type]}`}>
                {t.type}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-100 truncate">{t.title}</div>
                <div className="text-xs text-gray-500">{taskSummary(t)}</div>
              </div>
              <button onClick={() => { setEditingTask(t); setShowAdd(false); }}
                className="text-gray-500 hover:text-blue-400 text-xs flex-shrink-0">edit</button>
              <button onClick={() => archiveTask(t.id)}
                className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0">✕</button>
            </div>
          )
        ))}

        {showAdd && (
          <TaskForm
            targetUser={activeUser}
            onSave={createTask}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </div>

      {!showAdd && !editingTask && (
        <button
          onClick={() => { setShowAdd(true); setEditingTask(null); }}
          className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 text-sm transition-colors"
        >
          + Add task for {USER_LABELS[activeUser]}
        </button>
      )}
    </div>
  );
}

// ── Retroactive activity section ──────────────────────────────────────────────

function retroLabel(s) {
  const isLate    = s.date !== new Date(s.created_at).toISOString().slice(0, 10);
  const isEdited  = !!s.updated_at;
  const isDeleted = !!s.deleted;
  if (isDeleted) return { icon: '🔴', tag: 'deleted',    color: 'border-red-900 bg-red-950' };
  if (isEdited)  return { icon: '🟠', tag: 'edited',     color: 'border-orange-900 bg-orange-950' };
  if (isLate)    return { icon: '🟡', tag: 'logged late', color: 'border-yellow-900 bg-yellow-950' };
  return           { icon: '⚪', tag: 'flagged',    color: 'border-gray-700 bg-gray-900' };
}

function beforeAfter(s) {
  const lines = [];
  if (s.deleted) {
    const val = s.subject === 'gym'
      ? `Gym (${s.gym_type || '—'}) — removed`
      : `${s.subject}: ${s.duration_minutes ?? 0} min — removed`;
    lines.push(val);
  } else if (s.updated_at) {
    if (s.original_duration_minutes != null && s.original_duration_minutes !== s.duration_minutes) {
      lines.push(`Duration: ${s.original_duration_minutes}m → ${s.duration_minutes}m`);
    }
    if (s.original_gym_type != null && s.original_gym_type !== s.gym_type) {
      lines.push(`Type: ${s.original_gym_type} → ${s.gym_type}`);
    }
  }
  return lines;
}

function lateBy(session) {
  const created = new Date(session.created_at).toISOString().slice(0, 10);
  const sessionDate = session.date;
  const diff = Math.round((new Date(created) - new Date(sessionDate)) / 86400000);
  return diff > 0 ? `Logged ${diff} day${diff > 1 ? 's' : ''} late (on ${created})` : `Logged on ${created}`;
}

function RetroactiveSection() {
  const [showReviewed, setShowReviewed] = useState(false);
  const { data: flagged = [] } = useSWR('/tracker/api/sessions/flagged', fetcher, { refreshInterval: 10000 });

  async function dismiss(id) {
    await fetch(`/tracker/api/sessions/${id}/review`, { method: 'PATCH' });
    revalidateFlagged();
  }

  if (flagged.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 text-sm">
        No unreviewed activity. All clear.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flagged.map(s => {
        const { icon, tag, color } = retroLabel(s);
        const changes = beforeAfter(s);

        return (
          <div key={s.id} className={`rounded-xl border p-3 space-y-2 ${color}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{icon}</span>
                  <span className="text-xs text-gray-400 capitalize">{tag}</span>
                  <span className="text-xs text-gray-500">·</span>
                  <span className="text-xs font-medium text-gray-300">{s.user_name}</span>
                  <span className="text-xs text-gray-500">·</span>
                  <span className="text-xs text-gray-400">{s.date}</span>
                  <span className="text-xs text-gray-500">·</span>
                  <span className="text-xs text-gray-400 capitalize">{s.subject}</span>
                </div>

                {/* Detail lines */}
                {!s.deleted && !s.updated_at && (
                  <div className="text-xs text-gray-400 pl-5">{lateBy(s)}</div>
                )}
                {s.updated_at && !s.deleted && (
                  <div className="text-xs text-gray-400 pl-5">
                    Edited on {new Date(s.updated_at).toISOString().slice(0, 10)}
                  </div>
                )}
                {changes.map((l, i) => (
                  <div key={i} className="text-xs text-gray-300 pl-5">{l}</div>
                ))}
                {s.deleted && (
                  <div className="text-xs text-gray-400 pl-5">
                    Removed on {new Date(s.deleted_at).toISOString().slice(0, 10)}
                  </div>
                )}
              </div>

              <button
                onClick={() => dismiss(s.id)}
                className="text-xs text-gray-500 hover:text-green-400 flex-shrink-0 mt-0.5"
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── AdminPanel ────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [section, setSection] = useState('tasks');
  const { data: flagged = [] } = useSWR('/tracker/api/sessions/flagged', fetcher, { refreshInterval: 10000 });
  const unreviewed = flagged.length;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">Admin</h1>

      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
        <button
          onClick={() => setSection('tasks')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
            section === 'tasks' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setSection('retro')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            section === 'retro' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Activity Log
          {unreviewed > 0 && (
            <span className="bg-amber-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {unreviewed}
            </span>
          )}
        </button>
      </div>

      {section === 'tasks' && <TasksSection />}
      {section === 'retro' && <RetroactiveSection />}
    </div>
  );
}
