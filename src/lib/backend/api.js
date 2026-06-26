// API backend: talks to the self-hosted Node/Express server (Kubernetes mode).
// Selected at build time via PUBLIC_BACKEND=api (the default). See astro.config.
import { api, setToken, clearToken, getToken } from '../api.js';

export const isConfigured = true;

function normalize(t) {
  return {
    id: t.id,
    personId: t.person_id,
    projectName: t.project_name,
    periodStart: t.period_start,
    periodEnd: t.period_end,
    pinned: !!t.pinned,
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
export async function fetchTestimonialsByProject(project, period) {
  if (!project) return [];
  const qs = new URLSearchParams({ project });
  if (period?.start) qs.set('start', period.start);
  if (period?.end) qs.set('end', period.end);
  return ((await api(`/testimonials?${qs.toString()}`)) || []).map(normalize);
}
export async function fetchProjectNames() {
  return (await api('/project-names')) || { storyProjects: [], testimonialProjects: [] };
}
export async function fetchAdminProjectNames() {
  return (await api('/admin/project-names', { auth: true })) || { storyProjects: [], testimonialProjects: [] };
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
// In API mode a valid token is only ever issued to an admin (login checks the
// admins table), so a live session implies admin access.
export async function isAdmin() {
  return !!getToken();
}
export async function changePassword(currentPassword, newPassword) {
  await api('/auth/password', {
    method: 'POST',
    auth: true,
    body: { current_password: currentPassword, new_password: newPassword },
  });
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

// --- success stories ------------------------------------------------------
export async function fetchSuccessStories() {
  return (await api('/success-stories')) || [];
}
export async function fetchSuccessStory(id) {
  return api(`/success-stories/${id}`);
}
export async function fetchAllSuccessStories() {
  return (await api('/admin/success-stories', { auth: true })) || [];
}
export async function createStory(fields) {
  return api('/admin/success-stories', { method: 'POST', auth: true, body: fields });
}
export async function updateStory(id, fields) {
  await api(`/admin/success-stories/${id}`, { method: 'PATCH', auth: true, body: fields });
}
export async function deleteStory(id) {
  await api(`/admin/success-stories/${id}`, { method: 'DELETE', auth: true });
}
export async function setStoryChildren(id, children) {
  await api(`/admin/success-stories/${id}/children`, { method: 'PUT', auth: true, body: children });
}

// --- "function" endpoints (submit / request testimonial & story) ----------
export async function callFunction(name, body) {
  return api(`/fn/${name}`, { method: 'POST', body, auth: true });
}
