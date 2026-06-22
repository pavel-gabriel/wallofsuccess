import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true, gfm: true });

// Render user-authored markdown to sanitized HTML. DOMPurify runs in the
// browser; on the server it is a no-op-safe fallback to escaped text.
export function renderMarkdown(src) {
  if (!src) return '';
  const html = marked.parse(src);
  if (typeof window === 'undefined' || !DOMPurify.sanitize) {
    return escapeHtml(src);
  }
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

export function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// Deterministic pick of a sticky-note color from a fixed palette, based on id.
// Endava-palette note accents (see .note-* in global.css).
const NOTE_COLORS = ['note-1', 'note-2', 'note-3', 'note-4', 'note-5', 'note-6'];
export function noteColor(seed = '') {
  let h = 0;
  for (let i = 0; i < String(seed).length; i++) h = (h * 31 + String(seed).charCodeAt(i)) >>> 0;
  return NOTE_COLORS[h % NOTE_COLORS.length];
}

// Small deterministic rotation so the wall feels hand-pinned.
export function noteTilt(seed = '') {
  let h = 0;
  for (let i = 0; i < String(seed).length; i++) h = (h * 17 + String(seed).charCodeAt(i)) >>> 0;
  return ((h % 7) - 3); // -3..3 degrees
}
