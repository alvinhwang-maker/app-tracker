import { useState } from 'react';
import TodayScreen from './components/TodayScreen';
import ProgressScreen from './components/ProgressScreen';
import HistoryScreen from './components/HistoryScreen';

const TABS = [
  { id: 'today',    label: 'Today',    icon: '✓' },
  { id: 'progress', label: 'Progress', icon: '◎' },
  { id: 'history',  label: 'History',  icon: '▦' },
];

export default function App() {
  const [tab, setTab] = useState('today');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col max-w-md mx-auto">
      <div className="flex-1 overflow-y-auto pb-16">
        {tab === 'today'    && <TodayScreen />}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'history'  && <HistoryScreen />}
      </div>

      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-gray-900 border-t border-gray-800 flex">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${
              tab === t.id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
