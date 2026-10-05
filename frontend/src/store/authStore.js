import { create } from 'zustand';
import useCartStore from './cartStore';

const getStored = (key) => {
  const val = localStorage.getItem(key);
  return val && val !== 'null' ? val : null;
};

/** POS keys, or the HRMS session on the same origin (iframe embed). */
function readInitialSession() {
  const token = getStored('token');
  const userRaw = getStored('user');
  if (token) {
    let user = null;
    try { user = userRaw ? JSON.parse(userRaw) : null; } catch { user = null; }
    return { user, token, refreshToken: getStored('refreshToken') };
  }
  const hrmsRaw = getStored('hrms_auth');
  if (!hrmsRaw) return { user: null, token: null, refreshToken: null };
  try {
    const hrms = JSON.parse(hrmsRaw);
    if (!hrms?.token) return { user: null, token: null, refreshToken: null };
    localStorage.setItem('token', hrms.token);
    if (hrms.user) localStorage.setItem('user', JSON.stringify(hrms.user));
    if (hrms.refreshToken) localStorage.setItem('refreshToken', hrms.refreshToken);
    return {
      user: hrms.user || null,
      token: hrms.token,
      refreshToken: hrms.refreshToken || null,
    };
  } catch {
    return { user: null, token: null, refreshToken: null };
  }
}

const useAuthStore = create((set) => {
  const initial = readInitialSession();

  return {
    user: initial.user,
    token: initial.token,
    refreshToken: initial.refreshToken,
    isAuthenticated: !!initial.token,

    login: (user, token, refreshToken) => {
      const t = (token && token !== 'null' && token !== '') ? token : null;
      const rt = (refreshToken && refreshToken !== 'null' && refreshToken !== '') ? refreshToken : null;
      localStorage.setItem('user', JSON.stringify(user));
      if (t) localStorage.setItem('token', t); else localStorage.removeItem('token');
      if (rt) localStorage.setItem('refreshToken', rt); else localStorage.removeItem('refreshToken');
      set({ user, token: t, refreshToken: rt, isAuthenticated: !!t });
    },

    logout: () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      useCartStore.getState().clearCart();
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
    },

    updateUser: (user) => {
      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
    },

    updateTokens: (token, refreshToken) => {
      const t = (token && token !== 'null' && token !== '') ? token : null;
      const rt = (refreshToken && refreshToken !== 'null' && refreshToken !== '') ? refreshToken : null;
      if (t) localStorage.setItem('token', t); else localStorage.removeItem('token');
      if (rt) localStorage.setItem('refreshToken', rt); else localStorage.removeItem('refreshToken');
      set({ token: t, refreshToken: rt, isAuthenticated: !!t });
    },
  };
});

export default useAuthStore;
