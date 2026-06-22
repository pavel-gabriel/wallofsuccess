import { api } from './api.js';

// Calls the backend's "function" endpoints (formerly Supabase Edge Functions):
//   • submit-testimonial  -> public token flow (validate / submit)
//   • request-testimonial -> admin-or-apikey invite/link generation
// The stored admin JWT is attached automatically when present (it's required
// for request-testimonial, ignored for the public submit flow).
export async function callFunction(name, body) {
  return api(`/fn/${name}`, { method: 'POST', body, auth: true });
}

export async function readFunctionError(error, fallback = 'Request failed.') {
  return (error && error.message) || fallback;
}

// Read a file as a base64 data URL (used to ship a profile photo through the
// submit endpoint, which stores it server-side).
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
