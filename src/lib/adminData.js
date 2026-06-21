import { supabase } from './supabase.js';

// All of these require an authenticated admin session; RLS rejects them
// otherwise (see supabase/migrations). The UI only calls them after login.

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// --- Testimonials ---------------------------------------------------------
export async function setTestimonialStatus(id, status) {
  const patch = { status };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  const { error } = await supabase.from('testimonials').update(patch).eq('id', id);
  if (error) throw error;
}

export async function updateTestimonial(id, fields) {
  const { error } = await supabase.from('testimonials').update(fields).eq('id', id);
  if (error) throw error;
}

export async function updatePerson(id, fields) {
  const { error } = await supabase.from('people').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteTestimonial(id) {
  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  if (error) throw error;
}

export async function setTestimonialTags(testimonialId, tagIds) {
  // Replace the full tag set: delete then insert.
  const del = await supabase.from('testimonial_tags').delete().eq('testimonial_id', testimonialId);
  if (del.error) throw del.error;
  if (tagIds.length) {
    const rows = tagIds.map((fid) => ({ testimonial_id: testimonialId, filter_option_id: fid }));
    const ins = await supabase.from('testimonial_tags').insert(rows);
    if (ins.error) throw ins.error;
  }
}

// --- Comments -------------------------------------------------------------
export async function fetchAllComments() {
  const { data, error } = await supabase
    .from('comments')
    .select('id, testimonial_id, author_name, body, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setCommentStatus(id, status) {
  const { error } = await supabase.from('comments').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteComment(id) {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}

// --- Filter options -------------------------------------------------------
export async function addFilterOption(category, value, sortOrder = 0) {
  const { error } = await supabase
    .from('filter_options')
    .insert({ category: category.trim(), value: value.trim(), sort_order: sortOrder });
  if (error) throw error;
}

export async function deleteFilterOption(id) {
  const { error } = await supabase.from('filter_options').delete().eq('id', id);
  if (error) throw error;
}

// --- Settings -------------------------------------------------------------
export async function upsertSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}
