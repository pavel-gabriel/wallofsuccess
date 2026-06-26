import { useEffect, useState } from 'preact/hooks';
import { createStory, updateStory, setStoryChildren, fetchAdminProjectNames } from '../../lib/adminData.js';
import { toMonthInput, monthToDate } from '../../lib/util.js';

const CATEGORY_LABELS = {
  cloud_provider: 'Cloud provider', technology: 'Technology', domain: 'Domain',
  role: 'Role', seniority: 'Seniority',
};
const catLabel = (c) => CATEGORY_LABELS[c] || c.replace(/_/g, ' ');

export default function StoryEditor({ story, options = [], onCancel, onSaved }) {
  const editing = Boolean(story?.id);
  const [f, setF] = useState({
    title: story?.title || '',
    project_name: story?.projectName || '',
    period_start: toMonthInput(story?.periodStart),
    period_end: toMonthInput(story?.periodEnd),
    client_name: story?.clientName || '',
    client_alias: story?.clientAlias || '',
    industry: story?.industry || '',
    duration: story?.duration || '',
    summary: story?.summary || '',
    challenge: story?.challenge || '',
    solution: story?.solution || '',
    results: story?.results || '',
    status: story?.status || 'pending',
    is_public: story?.isPublic ?? false,
  });
  const [metrics, setMetrics] = useState(story?.metrics?.length ? story.metrics.map((m) => ({ label: m.label, value: m.value })) : [{ label: '', value: '' }]);
  const [contributors, setContributors] = useState(
    story?.contributors?.length
      ? story.contributors.map((c) => ({ name: c.name || '', role: c.role || '', contribution: c.contribution || '' }))
      : [{ name: '', role: '', contribution: '' }]
  );
  const [tags, setTags] = useState(new Set((story?.tags || []).map((t) => t.id)));
  const [projectOptions, setProjectOptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminProjectNames().then((p) => setProjectOptions(p.testimonialProjects || [])).catch(() => {});
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.currentTarget.value }));
  const grouped = {};
  for (const o of options) (grouped[o.category] ||= []).push(o);
  const updateRow = (setter) => (i, key, val) => setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const updateMetric = updateRow(setMetrics);
  const updateContributor = updateRow(setContributors);
  function toggleTag(id) {
    setTags((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save(e) {
    e.preventDefault();
    if (!f.title.trim()) {
      setError('Title is required.');
      return;
    }
    setBusy(true);
    setError('');
    const base = {
      ...f,
      is_public: Boolean(f.is_public),
      period_start: monthToDate(f.period_start),
      period_end: monthToDate(f.period_end),
    };
    const children = {
      metrics: metrics.filter((m) => m.label || m.value),
      contributors: contributors.filter((c) => c.name || c.role || c.contribution),
      tag_ids: Array.from(tags),
    };
    try {
      if (editing) {
        await updateStory(story.id, base);
        await setStoryChildren(story.id, children);
      } else {
        await createStory({ ...base, ...children });
      }
      await onSaved();
    } catch (e) {
      setError(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="story-editor" onSubmit={save}>
      <div class="field"><label>Project title</label><input type="text" value={f.title} onInput={set('title')} required /></div>
      <div class="field">
        <label>Project name <span class="hint">(links testimonials — pick an existing one or type your own)</span></label>
        <input type="text" list="se-project-names" value={f.project_name} onInput={set('project_name')} />
        <datalist id="se-project-names">{projectOptions.map((p) => <option value={p} key={p} />)}</datalist>
      </div>
      <div class="grid-2">
        <div class="field"><label>Client name <span class="hint">(internal)</span></label><input type="text" value={f.client_name} onInput={set('client_name')} /></div>
        <div class="field"><label>Client alias <span class="hint">(public)</span></label><input type="text" value={f.client_alias} onInput={set('client_alias')} /></div>
        <div class="field"><label>Industry</label><input type="text" value={f.industry} onInput={set('industry')} /></div>
        <div class="field"><label>Duration</label><input type="text" value={f.duration} onInput={set('duration')} /></div>
        <div class="field"><label>Period start <span class="hint">(month)</span></label><input type="month" value={f.period_start} onInput={set('period_start')} /></div>
        <div class="field"><label>Period end <span class="hint">(month)</span></label><input type="month" value={f.period_end} onInput={set('period_end')} /></div>
      </div>
      <div class="field"><label>Summary</label><textarea value={f.summary} style={{ minHeight: '54px' }} onInput={set('summary')} /></div>
      <div class="field"><label>Challenge</label><textarea value={f.challenge} onInput={set('challenge')} /></div>
      <div class="field"><label>Solution</label><textarea value={f.solution} onInput={set('solution')} /></div>
      <div class="field"><label>Results</label><textarea value={f.results} onInput={set('results')} /></div>

      <div class="field">
        <label>Metrics</label>
        {metrics.map((m, i) => (
          <div class="row-inline" key={i}>
            <input type="text" placeholder="Label" value={m.label} onInput={(e) => updateMetric(i, 'label', e.currentTarget.value)} />
            <input type="text" placeholder="Value" value={m.value} onInput={(e) => updateMetric(i, 'value', e.currentTarget.value)} />
          </div>
        ))}
        <button type="button" class="link-btn" onClick={() => setMetrics((r) => [...r, { label: '', value: '' }])}>+ Add metric</button>
      </div>

      <div class="field">
        <label>Contributors</label>
        {contributors.map((c, i) => (
          <div class="row-inline" key={i}>
            <input type="text" placeholder="Name" value={c.name} onInput={(e) => updateContributor(i, 'name', e.currentTarget.value)} />
            <input type="text" placeholder="Role" value={c.role} onInput={(e) => updateContributor(i, 'role', e.currentTarget.value)} />
            <input type="text" placeholder="Contribution" value={c.contribution} onInput={(e) => updateContributor(i, 'contribution', e.currentTarget.value)} />
          </div>
        ))}
        <button type="button" class="link-btn" onClick={() => setContributors((r) => [...r, { name: '', role: '', contribution: '' }])}>+ Add contributor</button>
      </div>

      {Object.keys(grouped).length > 0 && (
        <div class="field">
          <label>Tags</label>
          {Object.keys(grouped).map((cat) => (
            <div class="filter-group" key={cat}>
              <div class="filter-group-label">{catLabel(cat)}</div>
              <div class="chips">
                {grouped[cat].map((o) => (
                  <button type="button" key={o.id} class={`chip ${tags.has(o.id) ? 'active' : ''}`} onClick={() => toggleTag(o.id)}>{o.value}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="grid-2">
        <div class="field"><label>Status</label>
          <select value={f.status} onChange={set('status')}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div class="field"><label>Public visibility</label>
          <label class="checkline"><input type="checkbox" checked={f.is_public} onChange={(e) => setF((p) => ({ ...p, is_public: e.currentTarget.checked }))} /> Show in the public (anonymized) wall</label>
        </div>
      </div>

      {error && <div class="notice notice-error">{error}</div>}
      <div class="row-actions">
        <button class="btn btn-sm" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create story'}</button>
        <button class="btn btn-sm btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
