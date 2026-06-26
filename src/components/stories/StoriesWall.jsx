import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  isConfigured,
  fetchSuccessStories,
  fetchFilterOptions,
  fetchApprovedTestimonials,
  applyFilters,
  augmentStoriesWithMemberTags,
  groupStoriesByProject,
} from '../../lib/data.js';
import FilterBar from '../FilterBar.jsx';
import StoryCard from './StoryCard.jsx';
import StoryModal from './StoryModal.jsx';

export default function StoriesWall() {
  const [stories, setStories] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState({});
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const PAGE_SIZE = 24;

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    // Testimonials are loaded too so the Seniority/Role filter can match on the
    // stories' team members (see augmentStoriesWithMemberTags).
    Promise.all([
      fetchSuccessStories(),
      fetchFilterOptions(),
      fetchApprovedTestimonials().catch(() => []),
    ])
      .then(([s, o, t]) => {
        setStories(s);
        setOptions(o);
        setTestimonials(t);
      })
      .catch((e) => setError(e.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  const augmented = useMemo(
    () => augmentStoriesWithMemberTags(stories, testimonials),
    [stories, testimonials],
  );
  const filtered = useMemo(() => applyFilters(augmented, active), [augmented, active]);
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((s) =>
      `${s.title} ${s.clientAlias || ''} ${s.industry || ''} ${s.projectName || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [filtered, query]);
  const groups = useMemo(() => groupStoriesByProject(searched), [searched]);
  const visible = groups.slice(0, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [active, query]);

  function toggle(cat, id) {
    setActive((prev) => {
      const next = { ...prev };
      const set = new Set(next[cat] || []);
      set.has(id) ? set.delete(id) : set.add(id);
      next[cat] = set;
      return next;
    });
  }
  function clear() {
    setActive({});
  }

  if (!isConfigured) {
    return (
      <div class="notice notice-info">
        <strong>Backend not reachable.</strong> Make sure the API server is running (see the README).
      </div>
    );
  }
  if (loading) return <div class="spinner">Loading success stories…</div>;
  if (error) return <div class="notice notice-error">{error}</div>;

  return (
    <div>
      <FilterBar
        options={options}
        active={active}
        onToggle={toggle}
        onClear={clear}
        resultCount={groups.length}
        query={query}
        onQuery={setQuery}
        noun={{ one: 'story', other: 'stories' }}
      />

      {groups.length === 0 ? (
        <div class="empty-state">
          <p>No success stories match your filters yet.</p>
        </div>
      ) : (
        <>
          <div class="story-grid">
            {visible.map((g) => (
              <StoryCard key={g.key} group={g} onOpen={setOpen} />
            ))}
          </div>
          {visible.length < groups.length && (
            <div class="load-more">
              <button class="btn btn-secondary" onClick={() => setPage((p) => p + 1)}>
                Load more ({groups.length - visible.length} more)
              </button>
            </div>
          )}
        </>
      )}

      {open && <StoryModal group={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
