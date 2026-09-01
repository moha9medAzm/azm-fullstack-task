import type { ApiErrorBody } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'crm.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked); auth just won't persist.
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Array<{ path: string; message: string }>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
  }
}

/** Fired when a request comes back 401 so the app can drop to the login screen. */
export const authEvents = new EventTarget();

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}${buildQuery(opts.query)}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : undefined;

  if (!res.ok) {
    if (res.status === 401) authEvents.dispatchEvent(new Event('unauthenticated'));
    const body: ApiErrorBody = payload ?? { error: { code: 'UNKNOWN', message: res.statusText } };
    throw new ApiError(res.status, body);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => apiFetch<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
