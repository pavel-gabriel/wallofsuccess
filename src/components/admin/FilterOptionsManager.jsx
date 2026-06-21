import { useMemo, useState } from 'preact/hooks';
import { addFilterOption, deleteFilterOption } from '../../lib/adminData.js';

const catLabel = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export default function FilterOptionsManager({ options, onChange }) {
  const [category, setCategory] = useState('technology');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const g = {};
    for (const o of options) (g[o.category] ||= []).push(o);
    return g;
  }, [options]);

  const knownCategories = Object.keys(grouped);

  async function add(e) {
    e.preventDefault();
    if (!category.trim() || !value.trim()) return;
    setBusy(true);
    setError('');
    try {
      const slug = category.trim().toLowerCase().replace(/\s+/g, '_');
      const sort = (grouped[slug]?.length || 0) + 1;
      await addFilterOption(slug, value, sort);
      setValue('');
      await onChange();
    } catch (e) {
      setError(e.message || 'Could not add option.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Remove this filter option? It will be detached from any testimonials.')) return;
    await deleteFilterOption(id);
    await onChange();
  }

  return (
    <div>
      <p class="comment-meta">
        These options power the wall filters and the chips teammates pick when submitting.
      </p>

      {knownCategories.map((cat) => (
        <div class="filter-group" key={cat}>
          <div class="filter-group-label">{catLabel(cat)}</div>
          <div>
            {grouped[cat].map((o) => (
              <span class="tag-pill" key={o.id}>
                {o.value}
                <button title="Remove" onClick={() => remove(o.id)}>×</button>
              </span>
            ))}
          </div>
        </div>
      ))}

      <form onSubmit={add} class="panel" style={{ boxShadow: 'none', border: '1px solid var(--line)', marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Add an option</h3>
        <div class="field">
          <label>Category <span class="hint">(existing or new; use lowercase, e.g. cloud_provider)</span></label>
          <input type="text" list="cats" value={category} onInput={(e) => setCategory(e.currentTarget.value)} />
          <datalist id="cats">
            {knownCategories.map((c) => <option value={c} key={c} />)}
          </datalist>
        </div>
        <div class="field">
          <label>Value <span class="hint">(e.g. AWS, Kubernetes, FinTech)</span></label>
          <input type="text" value={value} onInput={(e) => setValue(e.currentTarget.value)} />
        </div>
        {error && <div class="notice notice-error">{error}</div>}
        <button class="btn btn-sm" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add option'}</button>
      </form>
    </div>
  );
}
