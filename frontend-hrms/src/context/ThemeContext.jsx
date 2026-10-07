import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

// Shared with the POS app (frontend/src/main.jsx + layouts/PosLayout.jsx) so
// the register and the back office always agree about light/dark. The legacy
// `hrms_theme` key is still read once, so an existing preference is not lost.
const THEME_KEY = 'minimart_theme';
const LEGACY_THEME_KEY = 'hrms_theme';

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode: theme === 'dark', theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}