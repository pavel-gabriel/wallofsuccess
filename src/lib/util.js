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

// Month + year label for a single period endpoint, e.g. "Jan 2025".
export function formatMonth(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// "Jan 2025 – Mar 2025" (or a single endpoint when only one is set).
export function formatPeriod(start, end) {
  const a = formatMonth(start);
  const b = formatMonth(end);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a || b || '';
}

// <input type="month"> bridges: a stored date/timestamp → "YYYY-MM" for the
// input, and the input's "YYYY-MM" → a "YYYY-MM-01" date string (null if empty).
export function toMonthInput(value) {
  if (!value) return '';
  const s = String(value);
  return s.length >= 7 ? s.slice(0, 7) : '';
}
export function monthToDate(month) {
  return month ? `${month}-01` : null;
}

// True when the inner period [s,e] is contained by the outer period [os,oe].
// Missing bounds are treated permissively (open-ended).
export function periodContains(outerStart, outerEnd, innerStart, innerEnd) {
  if (outerStart && innerStart && innerStart < outerStart) return false;
  if (outerEnd && innerEnd && innerEnd > outerEnd) return false;
  return true;
}

// Count badge wording: 2–9 → "3 noun"; >9 → "9+ noun"; ≤1 → "".
export function countLabel(n, noun) {
  if (n <= 1) return '';
  return `${n > 9 ? '9+' : n} ${noun}`;
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
