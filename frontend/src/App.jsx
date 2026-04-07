import { useState } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import UserPicker      from './components/UserPicker';
import TodayScreen     from './components/TodayScreen';
import ProgressScreen  from './components/ProgressScreen';
import HistoryScreen   from './components/HistoryScreen';
import AdminPanel      from './components/AdminPanel';

function AppContent() {
  const { user, clearUser } = useUser();
  const [tab, setTab] = useState('today');

  if (!user) return <UserPicker />;

  const isAdmin = user.role === 'admin';

  const TABS = [
    { id: 'today',    label: 'Today',    icon: '✓' },
    { id: 'progress', label: 'Progress', icon: '◎' },
    { id: 'history',  label: 'History',  icon: '▦' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: '⚙' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col max-w-md mx-auto">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-800 flex-shrink-0">
        <span className="font-medium text-gray-200">{user.name}</span>
        <button onClick={clearUser} className="text-xs text-gray-500 hover:text-gray-300">
          switch user
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-16">
        {tab === 'today'    && <TodayScreen />}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'history'  && <HistoryScreen />}
        {tab === 'admin'    && isAdmin && <AdminPanel />}
      </div>

      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-gray-900 border-t border-gray-800 flex z-10">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${
              tab === t.id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
