import { supabase } from './supabase.js';

// Shape returned by Supabase when we join people + tags onto testimonials.
const SELECT_FULL = `
  id, person_id, project_name, summary, body, status, created_at, approved_at,
  people:person_id ( id, name, title, photo_url ),
  testimonial_tags ( filter_options ( id, category, value ) )
`;

export async function fetchApprovedTestimonials() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('testimonials')
    .select(SELECT_FULL)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeTestimonial);
}

export async function fetchAllTestimonials() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('testimonials')
    .select(SELECT_FULL)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeTestimonial);
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

export function normalizeTestimonial(t) {
  return {
    id: t.id,
    personId: t.person_id,
    projectName: t.project_name,
    summary: t.summary,
    body: t.body,
    status: t.status,
    createdAt: t.created_at,
    approvedAt: t.approved_at,
    person: t.people || { id: t.person_id, name: 'Unknown', title: '', photo_url: null },
    tags: (t.testimonial_tags || [])
      .map((tt) => tt.filter_options)
      .filter(Boolean),
  };
}

// Group testimonials by person so a person with multiple entries renders as one
// sticky note that opens to tabs.
export function groupByPerson(testimonials) {
  const map = new Map();
  for (const t of testimonials) {
    const key = t.personId || t.person?.id;
    if (!map.has(key)) {
      map.set(key, { person: t.person, items: [] });
    }
    map.get(key).items.push(t);
  }
  return Array.from(map.values());
}

// Returns testimonials whose tags satisfy the active filter set.
// AND across categories, OR within a category.
export function applyFilters(testimonials, active) {
  const categories = Object.keys(active).filter((c) => active[c]?.size > 0);
  if (categories.length === 0) return testimonials;
  return testimonials.filter((t) => {
    const tagsByCat = {};
    for (const tag of t.tags) {
      (tagsByCat[tag.category] ||= new Set()).add(tag.id);
    }
    return categories.every((cat) => {
      const wanted = active[cat];
      const have = tagsByCat[cat];
      if (!have) return false;
      for (const id of wanted) if (have.has(id)) return true;
      return false;
    });
  });
}
