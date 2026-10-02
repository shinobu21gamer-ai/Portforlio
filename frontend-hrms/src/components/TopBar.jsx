import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../api/client';
import { useGlobalSearch } from '../context/GlobalSearchContext';
import { useTheme } from '../context/ThemeContext';
import { useUnreadCount, useNotifications, useMarkNotificationsRead, useMarkAllNotificationsRead } from '../hooks/useApi';

export default function TopBar() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const { openSearch } = useGlobalSearch();
  const { darkMode, toggleTheme } = useTheme();

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications({ limit: 10, isRead: 'false' });
  const markReadMut = useMarkNotificationsRead();
  const markAllReadMut = useMarkAllNotificationsRead();
  const unreadCount = unreadData?.unreadCount || 0;
  const notifications = notifData?.notifications || [];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = useCallback(async () => {
    try { await api.post('/auth/logout', {}, { baseURL: '/api/v1' }).catch(() => {}); } catch {}
    logout();
    navigate('/login');
  }, [logout, navigate]);

  return (
    <header className="topbar">
      <button className="search-trigger" onClick={openSearch} aria-label="Search (Ctrl+K)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="search-trigger__label">Search employees, departments, positions…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="topbar__actions">
        {!user && (
          <Link to="/login" className="topbar__login-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/></svg>
            Sign In
          </Link>
        )}
        <div ref={notifRef} className="topbar__bell">
          <button className="icon-btn" onClick={() => setNotifOpen(o => !o)} aria-label="Notifications" aria-expanded={notifOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="nav-badge topbar__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-dropdown__header">
                <strong>Notifications</strong>
                {unreadCount > 0 && (
                  <button className="btn btn--xs btn--outline" onClick={() => markAllReadMut.mutate()} disabled={markAllReadMut.isPending}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="notif-dropdown__empty">No notifications</div>
              ) : notifications.map(n => (
                <button
                  key={n.id}
                  className={`notif-dropdown__item ${n.isRead ? 'notif-dropdown__item--read' : 'notif-dropdown__item--unread'}`}
                  onClick={() => { if (!n.isRead) markReadMut.mutate([n.id]); }}
                >
                  <div className="notif-dropdown__title">{n.title}</div>
                  <div className="notif-dropdown__msg">{n.message}</div>
                  <div className="notif-dropdown__time">
                    {new Date(n.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-btn" onClick={toggleTheme} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle theme">
          {darkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button className="topbar__logout" onClick={handleLogout} title={`Sign out (${user?.firstName || ''})`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </header>
  );
}