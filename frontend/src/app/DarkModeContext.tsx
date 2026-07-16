'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface DarkModeContextType {
  isDark: boolean;
  toggleDark: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
  isDark: false,
  toggleDark: () => {},
});

const STORAGE_KEY = 'dojo-dark-mode';

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  // Default to light; hydrate from storage on mount
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setIsDark(true);
      else if (stored === '0') setIsDark(false);
      else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        setIsDark(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, isDark ? '1' : '0');
    } catch {}
  }, [isDark]);

  return (
    <DarkModeContext.Provider value={{ isDark, toggleDark: () => setIsDark((d) => !d) }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
