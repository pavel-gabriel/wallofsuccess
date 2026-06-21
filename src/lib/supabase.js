import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

// A single shared browser client. The anon key is public by design; all access
// control is enforced server-side by Row Level Security (see supabase/migrations).
// When env vars are missing (e.g. first clone before setup) we still export a
// client-shaped object so pages render with a friendly "not configured" notice
// instead of throwing during hydration.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'wof-auth',
      },
    })
  : null;

// Base path of the deployed site (e.g. "/wallofsuccess"), used to build links
// that work under GitHub Pages' subpath.
export const BASE = import.meta.env.BASE_URL || '/';

export function withBase(path) {
  const b = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
