import useSWR from 'swr';
import { useUser } from '../context/UserContext';

const fetcher = url => fetch(url).then(r => r.json());
const AVATARS = { alvin: '👨', adrian: '👦', hailey: '👧' };

export default function UserPicker() {
  const { selectUser } = useUser();
  const { data: users = [] } = useSWR('/tracker/api/users', fetcher);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Hey there 👋</h1>
      <p className="text-gray-500 text-sm mb-10">Who's using the tracker?</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => selectUser(u)}
            className="flex items-center gap-4 bg-gray-800 hover:bg-gray-700 rounded-2xl p-4 text-left transition-colors"
          >
            <span className="text-4xl">{AVATARS[u.id] || '👤'}</span>
            <div>
              <div className="font-semibold text-white">{u.name}</div>
              <div className="text-xs text-gray-400">{u.email}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
