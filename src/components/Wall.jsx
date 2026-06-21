import { useEffect, useMemo, useState } from 'preact/hooks';
import { isConfigured } from '../lib/supabase.js';
import {
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
  const [openGroup, setOpenGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  const moderationOn = settings.comment_moderation === 'on' || settings.comment_moderation === true;

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
        <strong>Backend not configured yet.</strong> Set <code>PUBLIC_SUPABASE_URL</code> and{' '}
        <code>PUBLIC_SUPABASE_ANON_KEY</code> (see <code>.env.example</code> and the README) to load
        the wall.
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
        resultCount={groups.length}
      />

      {groups.length === 0 ? (
        <div class="empty-state">
          <p>No testimonials match your filters yet.</p>
        </div>
      ) : (
        <div class="wall">
          {groups.map((g) => (
            <StickyNote key={g.person.id} group={g} onOpen={setOpenGroup} />
          ))}
        </div>
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
