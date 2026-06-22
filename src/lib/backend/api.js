// API backend: talks to the self-hosted Node/Express server (Kubernetes mode).
// Selected at build time via PUBLIC_BACKEND=api (the default). See astro.config.
import { api, setToken, clearToken, getToken } from '../api.js';

export const isConfigured = true;

function normalize(t) {
  return {
    id: t.id,
    personId: t.person_id,
    projectName: t.project_name,
    summary: t.summary,
    body: t.body,
    status: t.status,
    createdAt: t.created_at,
    approvedAt: t.approved_at,
    person: t.person || { id: t.person_id, name: 'Unknown', title: '', photo_url: null },
    tags: t.tags || [],
  };
}

// --- public reads ---------------------------------------------------------
export async function fetchApprovedTestimonials() {
  return ((await api('/testimonials')) || []).map(normalize);
}
export async function fetchAllTestimonials() {
  return ((await api('/admin/testimonials', { auth: true })) || []).map(normalize);
}
export async function fetchFilterOptions() {
  return (await api('/filter-options')) || [];
}
export async function fetchSettings() {
  return (await api('/settings')) || {};
}
export async function fetchComments(testimonialId) {
  return (await api(`/testimonials/${testimonialId}/comments`)) || [];
}
export async function postComment(testimonialId, { author_name, body }) {
  return api('/comments', {
    method: 'POST',
    body: { testimonial_id: testimonialId, author_name, body },
  });
}

// --- auth -----------------------------------------------------------------
export async function getSession() {
  if (!getToken()) return null;
  try {
    const me = await api('/auth/me', { auth: true });
    return me?.user ? { user: me.user } : null;
  } catch {
    clearToken();
    return null;
  }
}
export async function signIn(email, password) {
  const res = await api('/auth/login', { method: 'POST', body: { email, password } });
  setToken(res.token);
  return { user: res.user };
}
export async function signOut() {
  clearToken();
}

// --- admin mutations ------------------------------------------------------
export async function setTestimonialStatus(id, status) {
  await api(`/admin/testimonials/${id}`, { method: 'PATCH', auth: true, body: { status } });
}
export async function updateTestimonial(id, fields) {
  await api(`/admin/testimonials/${id}`, { method: 'PATCH', auth: true, body: fields });
}
export async function updatePerson(id, fields) {
  await api(`/admin/people/${id}`, { method: 'PATCH', auth: true, body: fields });
}
export async function deleteTestimonial(id) {
  await api(`/admin/testimonials/${id}`, { method: 'DELETE', auth: true });
}
export async function setTestimonialTags(testimonialId, tagIds) {
  await api(`/admin/testimonials/${testimonialId}/tags`, {
    method: 'PUT',
    auth: true,
    body: { tag_ids: tagIds },
  });
}
export async function fetchAllComments() {
  return (await api('/admin/comments', { auth: true })) || [];
}
export async function setCommentStatus(id, status) {
  await api(`/admin/comments/${id}`, { method: 'PATCH', auth: true, body: { status } });
}
export async function deleteComment(id) {
  await api(`/admin/comments/${id}`, { method: 'DELETE', auth: true });
}
export async function addFilterOption(category, value, sortOrder = 0) {
  await api('/admin/filter-options', {
    method: 'POST',
    auth: true,
    body: { category: category.trim(), value: value.trim(), sort_order: sortOrder },
  });
}
export async function deleteFilterOption(id) {
  await api(`/admin/filter-options/${id}`, { method: 'DELETE', auth: true });
}
export async function upsertSetting(key, value) {
  await api(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', auth: true, body: { value } });
}

// --- "function" endpoints (submit / request testimonial) ------------------
export async function callFunction(name, body) {
  return api(`/fn/${name}`, { method: 'POST', body, auth: true });
}
