import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalSearch from '../components/GlobalSearch';
import useAuthStore from '../store/authStore';

const GlobalSearchContext = createContext(null);

export function GlobalSearchProvider({ children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const openSearch = useCallback(() => {
    if (!isAuthenticated) return;
    setOpen(true);
  }, [isAuthenticated]);
  const closeSearch = useCallback(() => setOpen(false), []);

  const handleSelect = useCallback((action) => {
    if (!action) return;
    const { type, id } = action;
    switch (type) {
      case 'employee':
        navigate(`/employees/${id}`);
        break;
      case 'department':
        navigate('/departments');
        break;
      case 'position':
        navigate('/departments');
        break;
    }
  }, [navigate]);

  const handleKeyDown = useCallback((e) => {
    if (!isAuthenticated) return;
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setOpen(true);
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  }, [isAuthenticated, open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!isAuthenticated) setOpen(false);
  }, [isAuthenticated]);

  return (
    <GlobalSearchContext.Provider value={{ openSearch, closeSearch }}>
      {children}
      {isAuthenticated && <GlobalSearch isOpen={open} onClose={closeSearch} onSelect={handleSelect} />}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) throw new Error('useGlobalSearch must be used within GlobalSearchProvider');
  return ctx;
}