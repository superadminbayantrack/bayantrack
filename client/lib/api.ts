import axios from 'axios';
import { clearAuthSession } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
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
      clearAuthSession();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export function authHeaders() {
  return {};
}
