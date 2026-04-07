import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('tracker_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const selectUser = (u) => {
    setUser(u);
    localStorage.setItem('tracker_user', JSON.stringify(u));
  };

  const clearUser = () => {
    setUser(null);
    localStorage.removeItem('tracker_user');
  };

  return (
    <UserContext.Provider value={{ user, selectUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
