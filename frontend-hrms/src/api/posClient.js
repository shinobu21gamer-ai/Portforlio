import axios from 'axios';
import useAuthStore from '../store/authStore';
import { safeParse } from '../utils/helpers';

const posApi = axios.create({ baseURL: '/api/v1' });

posApi.interceptors.request.use((config) => {
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

posApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      const stored = localStorage.getItem('hrms_auth');
      if (!stored) {
        useAuthStore.getState().logout();
        window.location.href = `${import.meta.env.BASE_URL}login`;
        return Promise.reject(err);
      }

      const { refreshToken } = safeParse(stored);

      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = `${import.meta.env.BASE_URL}login`;
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return posApi(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post('/api/v1/auth/refresh-token', { refreshToken });
        const { token: newToken } = res.data.data;
        useAuthStore.getState().setToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return posApi(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        window.location.href = `${import.meta.env.BASE_URL}login`;
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default posApi;
