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
} from '@backend';

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
