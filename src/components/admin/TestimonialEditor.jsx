import { useMemo, useState } from 'preact/hooks';
import { updateTestimonial, updatePerson, setTestimonialTags } from '../../lib/adminData.js';

const catLabel = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

// Inline editor for a single testimonial + its person. `options` are all
// filter_options. Calls onSaved() after a successful save.
export default function TestimonialEditor({ testimonial: t, options, onSaved, onCancel }) {
  const [name, setName] = useState(t.person.name || '');
  const [title, setTitle] = useState(t.person.title || '');
  const [project, setProject] = useState(t.projectName || '');
  const [summary, setSummary] = useState(t.summary || '');
  const [body, setBody] = useState(t.body || '');
  const [tagIds, setTagIds] = useState(new Set((t.tags || []).map((x) => x.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const g = {};
    for (const o of options) (g[o.category] ||= []).push(o);
    return g;
  }, [options]);

  function toggle(id) {
    setTagIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updatePerson(t.person.id, { name: name.trim(), title: title.trim() });
      await updateTestimonial(t.id, {
        project_name: project.trim(),
        summary: summary.trim(),
        body: body.trim(),
      });
      await setTestimonialTags(t.id, Array.from(tagIds));
      onSaved && onSaved();
    } catch (e) {
      setError(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="panel" style={{ margin: '0.5rem 0', boxShadow: 'none', border: '1px solid var(--line)' }}>
      <div class="field">
        <label>Name</label>
        <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label>Title</label>
        <input type="text" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label>Project</label>
        <input type="text" value={project} onInput={(e) => setProject(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label>Summary</label>
        <textarea value={summary} style={{ minHeight: '60px' }} onInput={(e) => setSummary(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label>Body (Markdown)</label>
        <textarea value={body} onInput={(e) => setBody(e.currentTarget.value)} />
      </div>
      {Object.keys(grouped).map((cat) => (
        <div class="filter-group" key={cat}>
          <div class="filter-group-label">{catLabel(cat)}</div>
          <div class="chips">
            {grouped[cat].map((o) => (
              <button
                type="button"
                key={o.id}
                class={`chip ${tagIds.has(o.id) ? 'active' : ''}`}
                onClick={() => toggle(o.id)}
              >
                {o.value}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <div class="notice notice-error">{error}</div>}
      <div class="row-actions" style={{ marginTop: '0.75rem' }}>
        <button class="btn btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button class="btn btn-sm btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
