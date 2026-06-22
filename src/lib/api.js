// Same-origin REST client for the Wall of Fame backend. Replaces the Supabase
// browser client: the app is served by its own API server, so there is no
// public anon key — the server enforces auth (admin JWT) and validation.

const API = '/api';

// Base path of the deployed site. In the container we serve at '/', but this
// keeps GitHub-Pages-style subpaths working too.
export const BASE = import.meta.env.BASE_URL || '/';
export function withBase(path) {
  const b = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

const TOKEN_KEY = 'wof-token';
export function getToken() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(t) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

// Core fetch helper. Pass `auth: true` to attach the stored admin JWT.
export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text };
    }
  }
  if (!res.ok) {
    throw new Error((json && json.error) || `Request failed (${res.status})`);
  }
  return json;
}
