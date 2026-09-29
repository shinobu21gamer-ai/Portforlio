import { create } from 'zustand';

const useAuthStore = create((set, get) => {
  const stored = localStorage.getItem('hrms_auth');
  const initial = stored ? JSON.parse(stored) : { user: null, token: null, refreshToken: null };

  return {
    user: initial.user,
    token: initial.token,
    refreshToken: initial.refreshToken,
    isAuthenticated: !!initial.token,
    login: (user, token, refreshToken) => {
      localStorage.setItem('hrms_auth', JSON.stringify({ user, token, refreshToken }));
      set({ user, token, refreshToken, isAuthenticated: true });
    },
    setToken: (token) => {
      const current = get();
      localStorage.setItem('hrms_auth', JSON.stringify({ user: current.user, token, refreshToken: current.refreshToken }));
      set({ token });
    },
    logout: () => {
      localStorage.removeItem('hrms_auth');
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
    },
  };
});

export default useAuthStore;
