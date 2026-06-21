import { useMemo, useState } from 'preact/hooks';

const CATEGORY_LABELS = {
  cloud_provider: 'Cloud provider',
  technology: 'Technology',
  domain: 'Domain',
  role: 'Role',
  seniority: 'Seniority',
};

function label(cat) {
  return CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// active = { [category]: Set(optionId) }
export default function FilterBar({ options, active, onToggle, onClear, resultCount, query, onQuery }) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const g = {};
    for (const o of options) (g[o.category] ||= []).push(o);
    return g;
  }, [options]);

  const categories = Object.keys(grouped);
  const totalActive = Object.values(active).reduce((n, s) => n + (s?.size || 0), 0);

  return (
    <div class="filter-bar">
      {/* Collapsed line: a Filters toggle + a name search, always visible. */}
      <div class="filter-line">
        {categories.length > 0 && (
          <button
            type="button"
            class={`filter-toggle ${open ? 'open' : ''}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span class="filter-caret" aria-hidden="true">▸</span>
            Filters{totalActive > 0 ? ` (${totalActive})` : ''}
          </button>
        )}

        <input
          type="search"
          class="filter-search"
          placeholder="Search by name…"
          value={query}
          onInput={(e) => onQuery(e.currentTarget.value)}
        />

        <div class="filter-actions">
          <span>{resultCount} {resultCount === 1 ? 'person' : 'people'}</span>
          {(totalActive > 0 || query) && (
            <button class="link-btn" onClick={() => { onClear(); onQuery(''); }}>Clear</button>
          )}
        </div>
      </div>

      {/* Expanded chip groups. */}
      {open && categories.length > 0 && (
        <div class="filter-groups">
          {categories.map((cat) => (
            <div class="filter-group" key={cat}>
              <div class="filter-group-label">{label(cat)}</div>
              <div class="chips">
                {grouped[cat].map((o) => {
                  const isActive = active[cat]?.has(o.id);
                  return (
                    <button
                      key={o.id}
                      class={`chip ${isActive ? 'active' : ''}`}
                      onClick={() => onToggle(cat, o.id)}
                    >
                      {o.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
