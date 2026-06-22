// "Function" calls (submit-testimonial / request-testimonial), delegated to the
// build-selected backend. The helpers below are backend-agnostic.
export { callFunction } from '@backend';

export async function readFunctionError(error, fallback = 'Request failed.') {
  // Supabase FunctionsHttpError hides the reason in error.context (a Response);
  // the API backend throws Error(message) directly. Handle both.
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.clone === 'function') {
      const body = await ctx.clone().json().catch(() => null);
      if (body?.error) return body.error;
    }
  } catch {
    /* fall through */
  }
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
