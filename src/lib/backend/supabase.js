// Supabase backend: talks directly to Supabase (anon key + RLS). Selected at
// build time via PUBLIC_BACKEND=supabase — used for the GitHub Pages demo.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

// Browser-only client (persistSession + localStorage). Never constructed during
// SSR/build, where there is no WebSocket/localStorage. Data helpers guard on null.
const supabase =
  isConfigured && typeof window !== 'undefined'
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wof-auth' },
      })
    : null;

const SELECT_FULL = `
  id, person_id, project_name, period_start, period_end, pinned,
  summary, body, status, created_at, approved_at,
  people:person_id ( id, name, title, photo_url ),
  testimonial_tags ( filter_options ( id, category, value ) )
`;

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
    person: t.people || { id: t.person_id, name: 'Unknown', title: '', photo_url: null },
    tags: (t.testimonial_tags || []).map((tt) => tt.filter_options).filter(Boolean),
  };
}

// --- public reads ---------------------------------------------------------
export async function fetchApprovedTestimonials() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('testimonials')
    .select(SELECT_FULL)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}
export async function fetchAllTestimonials() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('testimonials')
    .select(SELECT_FULL)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}
export async function fetchFilterOptions() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('filter_options')
    .select('id, category, value, sort_order')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function fetchSettings() {
  if (!supabase) return {};
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;
  const out = {};
  for (const row of data || []) out[row.key] = row.value;
  return out;
}
export async function fetchComments(testimonialId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('comments')
    .select('id, testimonial_id, author_name, body, status, created_at')
    .eq('testimonial_id', testimonialId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function fetchTestimonialsByProject(project, period) {
  if (!supabase || !project) return [];
  let q = supabase
    .from('testimonials')
    .select(SELECT_FULL)
    .eq('status', 'approved')
    .ilike('project_name', project);
  // Containment: testimonial period must sit inside the story period (NULL
  // testimonial bounds are permissive via the `or` clauses).
  if (period?.start) q = q.or(`period_start.is.null,period_start.gte.${period.start}`);
  if (period?.end) q = q.or(`period_end.is.null,period_end.lte.${period.end}`);
  const { data, error } = await q.order('approved_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

function distinct(rows) {
  return [...new Set((rows || []).map((r) => (r.project_name || '').trim()).filter(Boolean))].sort();
}
// Story projects with their period(s) so the testimonial form can offer only
// projects whose period contains the testimonial's period. One entry per
// distinct (name, period) version.
function distinctStoryProjects(rows) {
  const seen = new Map();
  for (const r of rows || []) {
    const name = (r.project_name || '').trim();
    if (!name) continue;
    const key = `${name}|${r.period_start || ''}|${r.period_end || ''}`;
    if (!seen.has(key)) seen.set(key, { name, periodStart: r.period_start, periodEnd: r.period_end });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export async function fetchProjectNames() {
  if (!supabase) return { storyProjects: [], testimonialProjects: [] };
  const [s, t] = await Promise.all([
    supabase.from('public_success_stories').select('project_name, period_start, period_end'),
    supabase.from('testimonials').select('project_name').eq('status', 'approved'),
  ]);
  return { storyProjects: distinctStoryProjects(s.data), testimonialProjects: distinct(t.data) };
}
export async function fetchAdminProjectNames() {
  if (!supabase) return { storyProjects: [], testimonialProjects: [] };
  const [s, t] = await Promise.all([
    supabase.from('success_stories').select('project_name, period_start, period_end'),
    supabase.from('testimonials').select('project_name'),
  ]);
  return { storyProjects: distinctStoryProjects(s.data), testimonialProjects: distinct(t.data) };
}

export async function postComment(testimonialId, { author_name, body }) {
  if (!supabase) throw new Error('Backend not configured.');
  const ins = await supabase
    .from('comments')
    .insert({ testimonial_id: testimonialId, author_name, body })
    .select('id, testimonial_id, author_name, body, status, created_at');
  if (ins.error) throw ins.error;
  // If moderation is on, RLS hides the new (pending) row, so select returns
  // nothing — report pending so the UI doesn't optimistically show it.
  return (ins.data && ins.data[0]) || { status: 'pending' };
}

// --- auth -----------------------------------------------------------------
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
  if (supabase) await supabase.auth.signOut();
}
// True only when the signed-in user has a row in public.admins (checked via the
// security-definer is_admin() function). A logged-in non-admin returns false so
// the dashboard can show a clear "no access" message instead of empty tabs.
export async function isAdmin() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return !!data;
}
export async function changePassword(currentPassword, newPassword) {
  if (!supabase) throw new Error('Not configured.');
  // Re-verify the current password first (updateUser alone doesn't require it).
  const { data: u } = await supabase.auth.getUser();
  const email = u?.user?.email;
  if (email && currentPassword) {
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthErr) throw new Error('Current password is incorrect.');
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// --- admin mutations ------------------------------------------------------
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
  const del = await supabase.from('testimonial_tags').delete().eq('testimonial_id', testimonialId);
  if (del.error) throw del.error;
  if (tagIds.length) {
    const rows = tagIds.map((fid) => ({ testimonial_id: testimonialId, filter_option_id: fid }));
    const ins = await supabase.from('testimonial_tags').insert(rows);
    if (ins.error) throw ins.error;
  }
}
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
export async function upsertSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

// --- success stories ------------------------------------------------------
const STORY_EMBED =
  '*, story_metrics(*), story_contributors(*, people(name)), story_tags(filter_options(id,category,value))';

function normalizePublicStory(s) {
  return {
    id: s.id,
    title: s.title,
    projectName: s.project_name,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    clientAlias: s.client_alias,
    industry: s.industry,
    summary: s.summary,
    challenge: s.challenge,
    solution: s.solution,
    results: s.results,
    duration: s.duration,
    createdAt: s.created_at,
    approvedAt: s.approved_at,
    metrics: s.metrics || [],
    contributors: s.contributors || [],
    tags: s.tags || [],
  };
}
function normalizeStoryRow(s) {
  const byOrder = (a, b) => (a.sort_order || 0) - (b.sort_order || 0);
  return {
    id: s.id,
    title: s.title,
    projectName: s.project_name,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    clientName: s.client_name,
    clientAlias: s.client_alias,
    industry: s.industry,
    summary: s.summary,
    challenge: s.challenge,
    solution: s.solution,
    results: s.results,
    duration: s.duration,
    status: s.status,
    isPublic: s.is_public,
    createdAt: s.created_at,
    approvedAt: s.approved_at,
    metrics: (s.story_metrics || []).sort(byOrder).map((m) => ({ id: m.id, label: m.label, value: m.value })),
    contributors: (s.story_contributors || []).sort(byOrder).map((c) => ({
      id: c.id,
      person_id: c.person_id,
      name: (c.people && c.people.name) || c.name,
      role: c.role,
      contribution: c.contribution,
    })),
    tags: (s.story_tags || []).map((t) => t.filter_options).filter(Boolean),
  };
}

export async function fetchSuccessStories() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('public_success_stories')
    .select('*')
    .order('approved_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizePublicStory);
}
export async function fetchSuccessStory(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('public_success_stories').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalizePublicStory(data) : null;
}
export async function fetchAllSuccessStories() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('success_stories').select(STORY_EMBED).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeStoryRow);
}
export async function createStory(fields) {
  const { metrics, contributors, tag_ids, ...base } = fields;
  const ins = await supabase.from('success_stories').insert(base).select('id').single();
  if (ins.error) throw ins.error;
  await writeStoryChildren(ins.data.id, { metrics, contributors, tag_ids });
  return { id: ins.data.id };
}
export async function updateStory(id, fields) {
  const patch = { ...fields };
  if (fields.status === 'approved') patch.approved_at = new Date().toISOString();
  const { error } = await supabase.from('success_stories').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteStory(id) {
  const { error } = await supabase.from('success_stories').delete().eq('id', id);
  if (error) throw error;
}
export async function setStoryChildren(id, children) {
  await writeStoryChildren(id, children);
}
async function writeStoryChildren(id, { metrics, contributors, tag_ids }) {
  if (metrics) {
    await supabase.from('story_metrics').delete().eq('story_id', id);
    const rows = metrics
      .filter((m) => m.label || m.value)
      .map((m, i) => ({ story_id: id, label: m.label || '', value: m.value || '', sort_order: i }));
    if (rows.length) {
      const r = await supabase.from('story_metrics').insert(rows);
      if (r.error) throw r.error;
    }
  }
  if (contributors) {
    await supabase.from('story_contributors').delete().eq('story_id', id);
    const rows = contributors
      .filter((c) => c.name || c.role || c.person_id)
      .map((c, i) => ({
        story_id: id,
        person_id: c.person_id || null,
        name: c.name || '',
        role: c.role || '',
        contribution: c.contribution || '',
        sort_order: i,
      }));
    if (rows.length) {
      const r = await supabase.from('story_contributors').insert(rows);
      if (r.error) throw r.error;
    }
  }
  if (tag_ids) {
    await supabase.from('story_tags').delete().eq('story_id', id);
    if (tag_ids.length) {
      const r = await supabase.from('story_tags').insert(tag_ids.map((fid) => ({ story_id: id, filter_option_id: fid })));
      if (r.error) throw r.error;
    }
  }
}

// --- Edge Functions (submit / request testimonial & story) ----------------
// invoke attaches the logged-in admin's JWT (or anon for the public submit
// flow); the functions declare verify_jwt = false and authorize internally.
export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}
