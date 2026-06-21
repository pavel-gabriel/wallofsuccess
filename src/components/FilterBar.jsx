import { useMemo } from 'preact/hooks';

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
export default function FilterBar({ options, active, onToggle, onClear, resultCount }) {
  const grouped = useMemo(() => {
    const g = {};
    for (const o of options) (g[o.category] ||= []).push(o);
    return g;
  }, [options]);

  const categories = Object.keys(grouped);
  const totalActive = Object.values(active).reduce((n, s) => n + (s?.size || 0), 0);

  if (categories.length === 0) return null;

  return (
    <div class="filter-bar">
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
      <div class="filter-actions">
        <span>{resultCount} {resultCount === 1 ? 'person' : 'people'}</span>
        {totalActive > 0 && (
          <button class="link-btn" onClick={onClear}>Clear filters ({totalActive})</button>
        )}
      </div>
    </div>
  );
}
