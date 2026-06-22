import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  isConfigured,
  fetchApprovedTestimonials,
  fetchFilterOptions,
  fetchSettings,
  groupByPerson,
  applyFilters,
} from '../lib/data.js';
import FilterBar from './FilterBar.jsx';
import StickyNote from './StickyNote.jsx';
import TestimonialModal from './TestimonialModal.jsx';

export default function Wall() {
  const [testimonials, setTestimonials] = useState([]);
  const [options, setOptions] = useState([]);
  const [settings, setSettings] = useState({});
  const [active, setActive] = useState({}); // { category: Set(optionId) }
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [openGroup, setOpenGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const PAGE_SIZE = 24;

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    Promise.all([fetchApprovedTestimonials(), fetchFilterOptions(), fetchSettings()])
      .then(([t, o, s]) => {
        setTestimonials(t);
        setOptions(o);
        setSettings(s);
      })
      .catch((e) => setError(e.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => applyFilters(testimonials, active), [testimonials, active]);
  const groups = useMemo(() => groupByPerson(filtered), [filtered]);
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => (g.person?.name || '').toLowerCase().includes(q));
  }, [groups, query]);
  const visible = searched.slice(0, page * PAGE_SIZE);
  const moderationOn = settings.comment_moderation === 'on' || settings.comment_moderation === true;

  // Reset to the first page whenever the result set changes.
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

  if (loading) return <div class="spinner">Loading the wall…</div>;
  if (error) return <div class="notice notice-error">{error}</div>;

  return (
    <div>
      <FilterBar
        options={options}
        active={active}
        onToggle={toggle}
        onClear={clear}
        resultCount={searched.length}
        query={query}
        onQuery={setQuery}
      />

      {searched.length === 0 ? (
        <div class="empty-state">
          <p>No testimonials match your filters yet.</p>
        </div>
      ) : (
        <>
          <div class="wall">
            {visible.map((g) => (
              <StickyNote key={g.person.id} group={g} onOpen={setOpenGroup} />
            ))}
          </div>
          {visible.length < searched.length && (
            <div class="load-more">
              <button class="btn btn-secondary" onClick={() => setPage((p) => p + 1)}>
                Load more ({searched.length - visible.length} more)
              </button>
            </div>
          )}
        </>
      )}

      {openGroup && (
        <TestimonialModal
          group={openGroup}
          moderationOn={moderationOn}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}
