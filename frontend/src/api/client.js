import axios from 'axios';
import useAuthStore from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const HRMS_ORIGIN = (() => {
  const u = import.meta.env.VITE_HRMS_URL;
  if (u) { try { return new URL(u).origin; } catch { /* fallthrough */ } }
  return typeof window !== 'undefined' ? window.location.origin : '*';
})();

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
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

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token && token !== 'null' && token !== '') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = sessionStorage.getItem('refreshToken');
      if (refreshToken && refreshToken !== 'null' && refreshToken !== '') {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
          const { token: newToken, refreshToken: newRefreshToken } = res.data.data;
          sessionStorage.setItem('token', newToken);
          if (newRefreshToken) {
            sessionStorage.setItem('refreshToken', newRefreshToken);
          }
          try {
            useAuthStore.getState().updateTokens(newToken, newRefreshToken || null);
          } catch (e) { /* store not yet ready */ }
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (err) {
          processQueue(err, null);
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('refreshToken');
          sessionStorage.removeItem('user');
          if (window.top !== window) {
            window.parent.postMessage({ type: 'pos-auth-failed', error: 'Session expired' }, HRMS_ORIGIN);
          } else {
            window.location.href = '/login';
          }
        } finally {
          isRefreshing = false;
        }
      } else {
        isRefreshing = false;
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        if (window.top !== window) {
          window.parent.postMessage({ type: 'pos-auth-failed', error: 'No session' }, HRMS_ORIGIN);
        } else {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default client;
