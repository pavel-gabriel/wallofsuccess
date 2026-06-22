import { api } from './api.js';

// Public reads + comment posting. The backend returns testimonials already
// joined with their person and tags (see server/src/index.js).

export async function fetchApprovedTestimonials() {
  const rows = await api('/testimonials');
  return (rows || []).map(normalizeTestimonial);
}

export async function fetchAllTestimonials() {
  const rows = await api('/admin/testimonials', { auth: true });
  return (rows || []).map(normalizeTestimonial);
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
    person: t.person || { id: t.person_id, name: 'Unknown', title: '', photo_url: null },
    tags: t.tags || [],
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
