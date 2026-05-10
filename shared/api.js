import { CONFIG } from '/config.js';

export const API_URL = CONFIG.API_URL;

export const token = () => localStorage.getItem('authToken') || '';

export async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: `Bearer ${token()}` } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, opts);
  if (res.status === 204) return { success: true };
  return res.json();
}
