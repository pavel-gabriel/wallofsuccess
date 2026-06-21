// Helpers for calling Supabase Edge Functions from the browser.
const URL_BASE = import.meta.env.PUBLIC_SUPABASE_URL;
const ANON = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export async function callFunction(name, body) {
  if (!URL_BASE) throw new Error('Backend not configured.');
  const res = await fetch(`${URL_BASE}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify(body),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* ignore non-JSON */
  }
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}

// supabase.functions.invoke() throws a FunctionsHttpError whose `.message` is a
// generic "Edge Function returned a non-2xx status code". The function's real
// reason lives in the JSON body, reachable via `error.context` (a Response).
// This pulls it out so the admin sees the actual cause (e.g. "Unauthorized" or
// "PUBLIC_SITE_URL is not configured on the function.").
export async function readFunctionError(error, fallback = 'Request failed.') {
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.clone().json();
      if (body?.error) return body.error;
    }
    if (ctx && typeof ctx.text === 'function') {
      const text = await ctx.clone().text();
      if (text) return text;
    }
  } catch {
    /* fall through to the generic message */
  }
  return error?.message || fallback;
}

// Read a file as a base64 data URL (used to ship a profile photo through the
// submit function, which stores it with the service role).
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
