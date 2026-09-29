import { create } from 'zustand';

const getStoredRefreshToken = () => {
  const val = sessionStorage.getItem('refreshToken');
  return val && val !== 'null' ? val : null;
};

const useAuthStore = create((set) => ({
  user: JSON.parse(sessionStorage.getItem('user') || 'null'),
  token: (() => { const v = sessionStorage.getItem('token'); return (v && v !== 'null' && v !== '') ? v : null; })(),
  refreshToken: getStoredRefreshToken(),
  isAuthenticated: (() => { const v = sessionStorage.getItem('token'); return !!(v && v !== 'null' && v !== ''); })(),

  login: (user, token, refreshToken) => {
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('token', token || '');
    const rt = (refreshToken && refreshToken !== 'null' && refreshToken !== '') ? refreshToken : null;
    if (rt) {
      sessionStorage.setItem('refreshToken', rt);
    } else {
      sessionStorage.removeItem('refreshToken');
    }
    set({ user, token: (token && token !== 'null' && token !== '') ? token : null, refreshToken: rt, isAuthenticated: !!(token && token !== 'null' && token !== '') });
  },

  logout: () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    sessionStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  updateTokens: (token, refreshToken) => {
    const t = (token && token !== 'null' && token !== '') ? token : null;
    const rt = (refreshToken && refreshToken !== 'null' && refreshToken !== '') ? refreshToken : null;
    if (t) sessionStorage.setItem('token', t); else sessionStorage.removeItem('token');
    if (rt) sessionStorage.setItem('refreshToken', rt); else sessionStorage.removeItem('refreshToken');
    set({ token: t, refreshToken: rt, isAuthenticated: !!t });
  },
}));

export default useAuthStore;
