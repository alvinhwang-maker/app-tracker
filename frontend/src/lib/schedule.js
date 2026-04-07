// Weekly schedule: 0=Sun, 1=Mon, ..., 6=Sat
export const SCHEDULE = {
  0: [],
  1: ['gym', 'french', 'japanese', 'piano'],
  2: ['gym', 'french', 'japanese', 'piano'],
  3: ['gym', 'french', 'japanese', 'piano'],
  4: ['gym', 'french', 'japanese', 'piano'],
  5: ['gym', 'french', 'japanese', 'piano'],
  6: [],
};

export const SUBJECT_CONFIG = {
  gym:      { label: 'Gym',      icon: '🏋',  hasLessons: false, isGym: true },
  french:   { label: 'French',   icon: '🇫🇷', hasLessons: true,  totalLessons: 54 },
  japanese: { label: 'Japanese', icon: '🇯🇵', hasLessons: true,  totalLessons: 25 },
  piano:    { label: 'Piano',    icon: '🎹',  hasLessons: false },
};

export function getTodaySchedule() {
  const day = new Date().getDay();
  return (SCHEDULE[day] || []).map(id => ({ id, ...SUBJECT_CONFIG[id] }));
}

export function getScheduleForDate(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return (SCHEDULE[day] || []).map(id => ({ id, ...SUBJECT_CONFIG[id] }));
}

export function formatMinutes(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function toDateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Returns the start of the period containing `dateStr`
export function getPeriodStart(period, dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  if (period === 'day') return dateStr;
  if (period === 'week') {
    const dow = d.getDay() || 7; // Mon=1 … Sun=7
    d.setDate(d.getDate() - dow + 1);
    return d.toISOString().slice(0, 10);
  }
  if (period === 'month') return dateStr.slice(0, 7) + '-01';
  return dateStr;
}

// 13-week clock starting April 5 2026
const START = new Date('2026-04-05T00:00:00');
export function currentWeek() {
  const diff = Math.floor((Date.now() - START.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(diff + 1, 1), 13);
}
