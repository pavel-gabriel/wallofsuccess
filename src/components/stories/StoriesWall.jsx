import { useEffect, useMemo, useState } from 'preact/hooks';
import { isConfigured, fetchSuccessStories, fetchFilterOptions, applyFilters } from '../../lib/data.js';
import FilterBar from '../FilterBar.jsx';
import StoryCard from './StoryCard.jsx';
import StoryModal from './StoryModal.jsx';

export default function StoriesWall() {
  const [stories, setStories] = useState([]);
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
    Promise.all([fetchSuccessStories(), fetchFilterOptions()])
      .then(([s, o]) => {
        setStories(s);
        setOptions(o);
      })
      .catch((e) => setError(e.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => applyFilters(stories, active), [stories, active]);
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((s) =>
      `${s.title} ${s.clientAlias || ''} ${s.industry || ''}`.toLowerCase().includes(q)
    );
  }, [filtered, query]);
  const visible = searched.slice(0, page * PAGE_SIZE);

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
        resultCount={searched.length}
        query={query}
        onQuery={setQuery}
      />

      {searched.length === 0 ? (
        <div class="empty-state">
          <p>No success stories match your filters yet.</p>
        </div>
      ) : (
        <>
          <div class="story-grid">
            {visible.map((s) => (
              <StoryCard key={s.id} story={s} onOpen={setOpen} />
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

      {open && <StoryModal story={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
