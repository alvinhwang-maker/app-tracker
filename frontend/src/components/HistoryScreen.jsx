import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useUser } from '../context/UserContext';
import { formatMinutes } from '../lib/schedule';

const fetcher = url => fetch(url).then(r => r.json());
function pad(n) { return String(n).padStart(2, '0'); }

const DOT_COLORS = {
  french: 'bg-blue-400', japanese: 'bg-red-400',
  gym:    'bg-green-400', piano:    'bg-yellow-400',
};

const SUBJECTS = ['gym', 'french', 'japanese', 'piano'];

export default function HistoryScreen() {
  const { user } = useUser();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(null);

  // Edit state
  const [editingId,   setEditingId]   = useState(null);
  const [editDuration, setEditDuration] = useState('');
  const [editGymType,  setEditGymType]  = useState('');

  // Add-session form state
  const [showAdd,     setShowAdd]     = useState(false);
  const [addSubject,  setAddSubject]  = useState('gym');
  const [addDuration, setAddDuration] = useState('');
  const [addGymType,  setAddGymType]  = useState('self');

  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const from = `${year}-${pad(month)}-01`;
  const to   = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const sessionKey = user ? `/tracker/api/sessions?from=${from}&to=${to}&user_id=${user.id}` : null;
  const { data: sessions } = useSWR(sessionKey, fetcher);

  function revalidate() { mutate(sessionKey); }

  const byDay = {};
  (sessions || []).forEach(s => {
    if (!byDay[s.date]) byDay[s.date] = [];
    byDay[s.date].push(s);
  });

  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
    setSelected(null); resetForms();
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    setSelected(null); resetForms();
  }
  function resetForms() {
    setEditingId(null); setShowAdd(false);
  }

  async function handleDelete(id) {
    await fetch(`/tracker/api/sessions/${id}`, { method: 'DELETE' });
    revalidate();
    setEditingId(null);
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditDuration(String(s.duration_minutes || ''));
    setEditGymType(s.gym_type || 'self');
    setShowAdd(false);
  }

  async function saveEdit(s) {
    await fetch(`/tracker/api/sessions/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration_minutes: parseInt(editDuration, 10) || s.duration_minutes,
        gym_type: s.subject === 'gym' ? editGymType : s.gym_type,
      }),
    });
    revalidate();
    setEditingId(null);
  }

  async function handleAdd() {
    if (!selected) return;
    const body = {
      date: selected,
      subject: addSubject,
      user_id: user.id,
      duration_minutes: addSubject === 'gym' ? 0 : parseInt(addDuration, 10) || 0,
      gym_type: addSubject === 'gym' ? addGymType : null,
    };
    await fetch('/tracker/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    revalidate();
    setShowAdd(false);
    setAddDuration('');
  }

  const selectedSessions = selected ? (byDay[selected] || []) : [];
  const isPast = selected && selected < todayStr;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">History</h1>

      <div className="flex items-center justify-between">
        <button onClick={prev} className="text-gray-400 hover:text-white px-3 py-1 text-lg">←</button>
        <span className="font-medium">{monthLabel}</span>
        <button onClick={next} className="text-gray-400 hover:text-white px-3 py-1 text-lg">→</button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className={i >= 5 ? 'text-gray-700' : ''}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }).map((_, i) => <div key={`pad${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day     = i + 1;
          const dow     = (startOffset + i) % 7;
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const daySessions = byDay[dateStr] || [];
          const subjects    = [...new Set(daySessions.map(s => s.subject))];
          const isToday     = dateStr === todayStr;
          const isSelected  = dateStr === selected;
          const isWeekend   = dow >= 5;

          return (
            <button
              key={day}
              onClick={() => { setSelected(dateStr === selected ? null : dateStr); resetForms(); }}
              disabled={isWeekend}
              className={`rounded-lg p-1 flex flex-col items-center min-h-11 transition-colors ${
                isWeekend  ? 'opacity-20 cursor-default' :
                isSelected ? 'bg-gray-700' :
                isToday    ? 'bg-gray-800 ring-1 ring-blue-500' :
                             'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              <span className={`text-xs ${isToday ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>{day}</span>
              <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                {subjects.map(s => (
                  <span key={s} className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[s] || 'bg-gray-500'}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 flex-wrap text-xs text-gray-500">
        {Object.entries(DOT_COLORS).map(([s, cls]) => (
          <div key={s} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cls}`} />
            <span className="capitalize">{s}</span>
          </div>
        ))}
      </div>

      {/* Day detail */}
      {selected && (
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">
              {new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
              {isPast && <span className="ml-2 text-xs text-amber-500">retroactive edits flagged</span>}
            </h3>
            <button
              onClick={() => { setShowAdd(v => !v); setEditingId(null); }}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              + add session
            </button>
          </div>

          {/* Add session form */}
          {showAdd && (
            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <select
                  value={addSubject}
                  onChange={e => setAddSubject(e.target.value)}
                  className="bg-gray-700 text-sm rounded px-2 py-1 text-gray-100 flex-1"
                >
                  {SUBJECTS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
                {addSubject === 'gym' ? (
                  <button
                    onClick={() => setAddGymType(g => g === 'self' ? 'coach' : 'self')}
                    className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300"
                  >
                    {addGymType}
                  </button>
                ) : (
                  <input
                    type="number"
                    value={addDuration}
                    onChange={e => setAddDuration(e.target.value)}
                    placeholder="mins"
                    className="w-20 bg-gray-700 text-sm rounded px-2 py-1 text-gray-100 placeholder-gray-500"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">
                  Save
                </button>
                <button onClick={() => setShowAdd(false)} className="text-gray-500 text-xs hover:text-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Existing sessions */}
          {selectedSessions.length === 0 && !showAdd && (
            <p className="text-gray-600 text-sm">Nothing logged.</p>
          )}
          {selectedSessions.map(s => (
            <div key={s.id}>
              {editingId === s.id ? (
                <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                  <div className="text-xs text-gray-400 capitalize font-medium">{s.subject}</div>
                  <div className="flex gap-2 flex-wrap">
                    {s.subject === 'gym' ? (
                      <button
                        onClick={() => setEditGymType(g => g === 'self' ? 'coach' : 'self')}
                        className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300"
                      >
                        {editGymType}
                      </button>
                    ) : (
                      <input
                        type="number"
                        value={editDuration}
                        onChange={e => setEditDuration(e.target.value)}
                        placeholder="mins"
                        className="w-24 bg-gray-700 text-sm rounded px-2 py-1 text-gray-100"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(s)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs hover:text-gray-300">
                      Cancel
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-400 text-xs ml-auto">
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm group">
                  <span className="text-gray-300 capitalize">
                    {s.subject}{s.gym_type ? ` (${s.gym_type})` : ''}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">
                      {s.duration_minutes > 0 ? formatMinutes(s.duration_minutes) : '—'}
                    </span>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-gray-600 hover:text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
