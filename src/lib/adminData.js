import { api, setToken, clearToken, getToken } from './api.js';

// Admin auth + content mutations. All mutating calls send the stored JWT; the
// backend rejects anything without a valid admin token.

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

// --- Testimonials ---------------------------------------------------------
export async function setTestimonialStatus(id, status) {
  // approved_at is set server-side when status becomes 'approved'.
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

// --- Comments -------------------------------------------------------------
export async function fetchAllComments() {
  return (await api('/admin/comments', { auth: true })) || [];
}

export async function setCommentStatus(id, status) {
  await api(`/admin/comments/${id}`, { method: 'PATCH', auth: true, body: { status } });
}

export async function deleteComment(id) {
  await api(`/admin/comments/${id}`, { method: 'DELETE', auth: true });
}

// --- Filter options -------------------------------------------------------
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

// --- Settings -------------------------------------------------------------
export async function upsertSetting(key, value) {
  await api(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', auth: true, body: { value } });
}
