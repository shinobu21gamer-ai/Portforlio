import { create } from 'zustand';
import useCartStore from './cartStore';

const useAuthStore = create((set) => {
  const getStored = (key) => {
    const val = localStorage.getItem(key);
    return val && val !== 'null' ? val : null;
  };

  return {
    user: getStored('user') ? JSON.parse(localStorage.getItem('user')) : null,
    token: getStored('token'),
    refreshToken: getStored('refreshToken'),
    isAuthenticated: !!getStored('token'),

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
