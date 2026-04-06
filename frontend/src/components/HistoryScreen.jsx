import { useState } from 'react';
import useSWR from 'swr';
import { formatMinutes } from '../lib/schedule';

const fetcher = url => fetch(url).then(r => r.json());
function pad(n) { return String(n).padStart(2, '0'); }

const DOT_COLORS = {
  french:   'bg-blue-400',
  japanese: 'bg-red-400',
  gym:      'bg-green-400',
  piano:    'bg-yellow-400',
};

export default function HistoryScreen() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  // Start of month day-of-week, Mon=0
  const startOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const from = `${year}-${pad(month)}-01`;
  const to   = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const { data: sessions } = useSWR(`/tracker/api/sessions?from=${from}&to=${to}`, fetcher);

  const byDay = {};
  sessions?.forEach(s => {
    if (!byDay[s.date]) byDay[s.date] = [];
    byDay[s.date].push(s);
  });

  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
    setSelected(null);
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    setSelected(null);
  }

  const selectedSessions = selected ? (byDay[selected] || []) : [];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">History</h1>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="text-gray-400 hover:text-white px-3 py-1 text-lg">←</button>
        <span className="font-medium">{monthLabel}</span>
        <button onClick={next} className="text-gray-400 hover:text-white px-3 py-1 text-lg">→</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className={i >= 5 ? 'text-gray-700' : ''}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`pad${i}`} />)}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dow = (startOffset + i) % 7; // Mon=0
          const isWeekend = dow >= 5;
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const daySessions = byDay[dateStr] || [];
          const subjects = [...new Set(daySessions.map(s => s.subject))];
          const isToday    = dateStr === todayStr;
          const isSelected = dateStr === selected;

          return (
            <button
              key={day}
              onClick={() => !isWeekend && setSelected(dateStr === selected ? null : dateStr)}
              disabled={isWeekend}
              className={`rounded-lg p-1 flex flex-col items-center min-h-11 transition-colors ${
                isWeekend   ? 'opacity-20 cursor-default' :
                isSelected  ? 'bg-gray-700' :
                isToday     ? 'bg-gray-800 ring-1 ring-blue-500' :
                              'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              <span className={`text-xs ${isToday ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                {day}
              </span>
              <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                {subjects.map(s => (
                  <span key={s} className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[s] || 'bg-gray-500'}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
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
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm">
            {new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </h3>
          {selectedSessions.length === 0 ? (
            <p className="text-gray-500 text-sm">Nothing logged.</p>
          ) : (
            selectedSessions.map(s => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-gray-300 capitalize">
                  {s.subject}{s.gym_type ? ` (${s.gym_type})` : ''}
                </span>
                <span className="text-gray-400">
                  {s.duration_minutes > 0 ? formatMinutes(s.duration_minutes) : '—'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
