import { getToken, clearToken } from './auth.js';

async function request(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/linde${path}`, opts);
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Sesja wygasła');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const searchLinde = (q) => request('GET', `/search?q=${encodeURIComponent(q)}`);
export const importLinde = (data) => request('POST', '/import', data);
export const askLinde = (data) => request('POST', '/ask', data);
