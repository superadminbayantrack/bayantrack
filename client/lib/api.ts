import axios from 'axios';
import { clearAuthSession, getAuthSessionMeta } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const AUTH_LOGIN_GRACE_MS = 5_000;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export const quietApi = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const msg = String(error?.response?.data?.msg || '');
    const isInvalidToken =
      status === 401 &&
      (msg.includes('Token is not valid') ||
        msg.includes('Invalid token user') ||
        msg.includes('No token, authorization denied'));

    if (isInvalidToken) {
      const sessionMeta = getAuthSessionMeta();
      const loginAt = sessionMeta?.loginAt ? Date.parse(sessionMeta.loginAt) : 0;
      const isFreshLogin = Boolean(loginAt) && Date.now() - loginAt < AUTH_LOGIN_GRACE_MS;

      if (!isFreshLogin) {
        clearAuthSession();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export function authHeaders() {
  return {};
}
