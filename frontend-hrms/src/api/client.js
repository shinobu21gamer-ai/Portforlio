import axios from 'axios';
import useAuthStore from '../store/authStore';
import { safeParse } from '../utils/helpers';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1/hrms';
const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('hrms_auth');
  if (stored) {
    const { token } = safeParse(stored);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

const redirectToLogin = () => {
  useAuthStore.getState().logout();
  window.location.href = `${import.meta.env.BASE_URL}login`;
};

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      const stored = localStorage.getItem('hrms_auth');
      if (!stored) {
        redirectToLogin();
        return Promise.reject(err);
      }

      const { refreshToken } = safeParse(stored);

      if (!refreshToken) {
        redirectToLogin();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE.replace('/hrms', '')}/auth/refresh-token`, { refreshToken });
        const { token: newToken } = res.data.data;
        useAuthStore.getState().setToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        redirectToLogin();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
