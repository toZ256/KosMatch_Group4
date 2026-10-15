import axios, { AxiosError } from 'axios';
import type { ApiFailure, ApiSuccess } from '@kosmatch/shared';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const http = axios.create({ baseURL: '/api', timeout: 15000 });

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiFailure>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    // Expired/invalid session (e.g. server restarted): clear it so the UI can redirect to login.
    if (status === 401 && useAuthStore.getState().token && !error.config?.url?.startsWith('/auth/login')) {
      useAuthStore.getState().logout();
      toast.info('Sesi berakhir, silakan masuk lagi');
    }
    const message = body?.error?.message ?? (status === 0 ? 'Tidak dapat terhubung ke server' : 'Terjadi kesalahan');
    return Promise.reject(new ApiError(message, body?.error?.code ?? 'INTERNAL', status));
  },
);

/** Unwraps the `{ ok, data }` envelope. */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await http.get<ApiSuccess<T>>(url, { params });
  return res.data.data;
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.post<ApiSuccess<T>>(url, body);
  return res.data.data;
}
export async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.put<ApiSuccess<T>>(url, body);
  return res.data.data;
}
export async function del<T>(url: string): Promise<T> {
  const res = await http.delete<ApiSuccess<T>>(url);
  return res.data.data;
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Terjadi kesalahan');
