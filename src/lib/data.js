// Public data access. Backend-specific calls come from the build-selected
// backend (@backend = src/lib/backend/{api,supabase}.js); the grouping/filtering
// helpers below are pure and shared by both.
export {
  isConfigured,
  fetchApprovedTestimonials,
  fetchAllTestimonials,
  fetchFilterOptions,
  fetchSettings,
  fetchComments,
  postComment,
  fetchSuccessStories,
  fetchSuccessStory,
  fetchTestimonialsByProject,
  fetchProjectNames,
} from '@backend';

// Group testimonials by person so a person with multiple entries renders as one
// sticky note that opens to tabs. Keyed by normalized name (each submission
// creates a fresh people row, so the same human would otherwise appear as
// several cards). Within a group, a pinned testimonial leads, then most recent
// period; the representative person comes from that leading item.
export function groupByPerson(testimonials) {
  const map = new Map();
  for (const t of testimonials) {
    const key = (t.person?.name || '').trim().toLowerCase() || t.personId || t.person?.id;
    if (!map.has(key)) map.set(key, { person: t.person, items: [] });
    map.get(key).items.push(t);
  }
  for (const group of map.values()) {
    group.items.sort(sortPinnedThenRecent);
    group.person = group.items[0]?.person || group.person;
  }
  return Array.from(map.values());
}

// Pinned first, then latest period (by end, then start), then newest created.
export function sortPinnedThenRecent(a, b) {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  const ae = a.periodEnd || a.periodStart || '';
  const be = b.periodEnd || b.periodStart || '';
  if (ae !== be) return ae < be ? 1 : -1;
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

// Distinct non-empty project names across a person's testimonials.
export function distinctProjectCount(items) {
  return new Set(
    (items || []).map((t) => (t.projectName || '').trim().toLowerCase()).filter(Boolean),
  ).size;
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
