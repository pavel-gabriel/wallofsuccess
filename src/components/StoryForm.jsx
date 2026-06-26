import { useEffect, useMemo, useState } from 'preact/hooks';
import { isConfigured, fetchFilterOptions, fetchProjectNames } from '../lib/data.js';
import { callFunction } from '../lib/functions.js';
import { monthToDate } from '../lib/util.js';

const CATEGORY_LABELS = {
  cloud_provider: 'Cloud provider',
  technology: 'Technology',
  domain: 'Domain',
  role: 'Role',
  seniority: 'Seniority',
};
const catLabel = (c) => CATEGORY_LABELS[c] || c.replace(/_/g, ' ');

export default function StoryForm() {
  const [token, setToken] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | invalid | form | done | error
  const [options, setOptions] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [f, setF] = useState({
    title: '', project_name: '', client_name: '', client_alias: '', industry: '', duration: '',
    summary: '', challenge: '', solution: '', results: '',
  });
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [metrics, setMetrics] = useState([{ label: '', value: '' }]);
  const [contributors, setContributors] = useState([{ name: '', role: '', contribution: '' }]);
  const [tags, setTags] = useState(new Set());
  const [projectOptions, setProjectOptions] = useState([]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.currentTarget.value }));

  useEffect(() => {
    if (!isConfigured) {
      setPhase('error');
      setError('Backend not configured.');
      return;
    }
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
    if (!t) {
      setPhase('invalid');
      return;
    }
    Promise.all([
      callFunction('submit-story', { action: 'validate', token: t }),
      fetchFilterOptions(),
      fetchProjectNames().catch(() => ({ testimonialProjects: [] })),
    ])
      .then(([res, opts, projects]) => {
        setF((p) => ({
          ...p,
          client_name: res.request?.client_name || '',
          title: res.request?.project_name || '',
          project_name: res.request?.project_name || '',
        }));
        setOptions(opts);
        setProjectOptions(projects.testimonialProjects || []);
        setPhase('form');
      })
      .catch((e) => {
        setError(e.message || 'This link is invalid or has expired.');
        setPhase('invalid');
      });
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    // Seniority is derived from the team members on the wall, not picked here.
    for (const o of options) {
      if (o.category === 'seniority') continue;
      (g[o.category] ||= []).push(o);
    }
    return g;
  }, [options]);

  function toggleTag(id) {
    setTags((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const updateRow = (setter) => (i, key, val) =>
    setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const updateMetric = updateRow(setMetrics);
  const updateContributor = updateRow(setContributors);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!f.title.trim()) {
      setError('Please give the project a title.');
      return;
    }
    setSubmitting(true);
    try {
      await callFunction('submit-story', {
        action: 'submit',
        token,
        ...f,
        period_start: monthToDate(periodStart),
        period_end: monthToDate(periodEnd),
        metrics: metrics.filter((m) => m.label || m.value),
        contributors: contributors.filter((c) => c.name || c.role || c.contribution),
        tag_ids: Array.from(tags),
      });
      setPhase('done');
    } catch (e) {
      setError(e.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') return <div class="panel"><p>Checking your link…</p></div>;
  if (phase === 'error') return <div class="panel"><div class="notice notice-error">{error}</div></div>;
  if (phase === 'invalid')
    return (
      <div class="panel">
        <h2>Link not valid</h2>
        <div class="notice notice-error">{error || 'This link is missing, invalid, or already used.'}</div>
        <p>Please ask your contact to send a fresh link.</p>
      </div>
    );
  if (phase === 'done')
    return (
      <div class="panel">
        <h2>🎉 Thank you!</h2>
        <div class="notice notice-success">
          The success story has been submitted and is awaiting review. Once approved it can be used in bids.
        </div>
      </div>
    );

  return (
    <div class="panel">
      <h2>Capture the success story</h2>
      <p class="comment-meta">
        Record what was delivered for this client on this engagement — no account needed.
        Client name is kept internal; the public view uses the alias.
      </p>
      <form onSubmit={submit}>
        <div class="field"><label>Project title</label>
          <input type="text" value={f.title} onInput={set('title')} required /></div>
        <div class="field"><label>Project name <span class="hint">(links testimonials — pick an existing one or type your own)</span></label>
          <input type="text" list="storyform-projects" value={f.project_name} onInput={set('project_name')} />
          <datalist id="storyform-projects">{projectOptions.map((p) => <option value={p} key={p} />)}</datalist></div>
        <div class="field"><label>Client name <span class="hint">(internal only)</span></label>
          <input type="text" value={f.client_name} onInput={set('client_name')} /></div>
        <div class="field"><label>Client alias <span class="hint">(public, e.g. "Tier-1 EU bank")</span></label>
          <input type="text" value={f.client_alias} onInput={set('client_alias')} /></div>
        <div class="field"><label>Industry</label>
          <input type="text" value={f.industry} onInput={set('industry')} /></div>
        <div class="field-row">
          <div class="field"><label>Period start <span class="hint">(month)</span></label>
            <input type="month" value={periodStart} onInput={(e) => setPeriodStart(e.currentTarget.value)} /></div>
          <div class="field"><label>Period end <span class="hint">(month)</span></label>
            <input type="month" value={periodEnd} onInput={(e) => setPeriodEnd(e.currentTarget.value)} /></div>
        </div>
        <div class="field"><label>Duration <span class="hint">(e.g. "8 months")</span></label>
          <input type="text" value={f.duration} onInput={set('duration')} /></div>
        <div class="field"><label>Summary <span class="hint">(one-line teaser)</span></label>
          <textarea value={f.summary} maxLength={400} style={{ minHeight: '60px' }} onInput={set('summary')} /></div>
        <div class="field"><label>Challenge <span class="hint">(Markdown ok)</span></label>
          <textarea value={f.challenge} onInput={set('challenge')} /></div>
        <div class="field"><label>Solution</label>
          <textarea value={f.solution} onInput={set('solution')} /></div>
        <div class="field"><label>Results</label>
          <textarea value={f.results} onInput={set('results')} /></div>

        <div class="field">
          <label>Key metrics <span class="hint">(e.g. "Infra cost" / "−40%")</span></label>
          {metrics.map((m, i) => (
            <div class="row-inline" key={i}>
              <input type="text" placeholder="Label" value={m.label} onInput={(e) => updateMetric(i, 'label', e.currentTarget.value)} />
              <input type="text" placeholder="Value" value={m.value} onInput={(e) => updateMetric(i, 'value', e.currentTarget.value)} />
            </div>
          ))}
          <button type="button" class="link-btn" onClick={() => setMetrics((r) => [...r, { label: '', value: '' }])}>+ Add metric</button>
        </div>

        <div class="field">
          <label>Team / contributors</label>
          {contributors.map((c, i) => (
            <div class="row-inline" key={i}>
              <input type="text" placeholder="Name" value={c.name} onInput={(e) => updateContributor(i, 'name', e.currentTarget.value)} />
              <input type="text" placeholder="Role" value={c.role} onInput={(e) => updateContributor(i, 'role', e.currentTarget.value)} />
              <input type="text" placeholder="What they did" value={c.contribution} onInput={(e) => updateContributor(i, 'contribution', e.currentTarget.value)} />
            </div>
          ))}
          <button type="button" class="link-btn" onClick={() => setContributors((r) => [...r, { name: '', role: '', contribution: '' }])}>+ Add contributor</button>
        </div>

        {Object.keys(grouped).length > 0 && (
          <div class="field">
            <label>Tags <span class="hint">(cloud / tech / domain)</span></label>
            {Object.keys(grouped).map((cat) => (
              <div class="filter-group" key={cat}>
                <div class="filter-group-label">{catLabel(cat)}</div>
                <div class="chips">
                  {grouped[cat].map((o) => (
                    <button type="button" key={o.id} class={`chip ${tags.has(o.id) ? 'active' : ''}`} onClick={() => toggleTag(o.id)}>
                      {o.value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div class="notice notice-error">{error}</div>}
        <button class="btn" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit success story'}
        </button>
      </form>
    </div>
  );
}
