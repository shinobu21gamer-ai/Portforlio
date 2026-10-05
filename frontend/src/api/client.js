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
  const token = localStorage.getItem('token');
  if (token && token !== 'null' && token !== '') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Forced first-login password change: the server returns
    // 403 { errors: { code: 'MUST_CHANGE_PASSWORD' } } on every protected
    // route (except change-password/logout) for flagged accounts. Clear the
    // session and go to the dedicated change screen. (In-iframe: hand back
    // to the HRMS host, which applies the same rule to its own session.)
    if (error.response?.status === 403 && error.response?.data?.errors?.code === 'MUST_CHANGE_PASSWORD') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      if (window.top !== window) {
        window.parent.postMessage({ type: 'pos-auth-failed', error: 'Password change required' }, HRMS_ORIGIN);
      } else {
        window.location.href = '/change-password';
      }
      return Promise.reject(error);
    }
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

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && refreshToken !== 'null' && refreshToken !== '') {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
          const { token: newToken, refreshToken: newRefreshToken } = res.data.data;
          localStorage.setItem('token', newToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }
          try {
            useAuthStore.getState().updateTokens(newToken, newRefreshToken || null);
          } catch (e) { /* store not yet ready */ }
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (err) {
          processQueue(err, null);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
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
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
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
