import { useEffect, useMemo, useState } from 'preact/hooks';
import { isConfigured } from '../lib/supabase.js';
import { fetchFilterOptions } from '../lib/data.js';
import { callFunction, fileToDataUrl } from '../lib/functions.js';

const CATEGORY_LABELS = {
  cloud_provider: 'Cloud provider',
  technology: 'Technology',
  domain: 'Domain',
  role: 'Role',
  seniority: 'Seniority',
};
const catLabel = (c) => CATEGORY_LABELS[c] || c.replace(/_/g, ' ');
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export default function SubmitForm() {
  const [token, setToken] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | invalid | form | done | error
  const [request, setRequest] = useState(null);
  const [options, setOptions] = useState([]);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      callFunction('submit-testimonial', { action: 'validate', token: t }),
      fetchFilterOptions(),
    ])
      .then(([res, opts]) => {
        setRequest(res.request);
        setName(res.request?.person_name || '');
        setProject(res.request?.project_name || '');
        setOptions(opts);
        setPhase('form');
      })
      .catch((e) => {
        setError(e.message || 'This link is invalid or has expired.');
        setPhase('invalid');
      });
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    for (const o of options) (g[o.category] ||= []).push(o);
    return g;
  }, [options]);

  function toggleTag(id) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !summary.trim() || !body.trim()) {
      setError('Please fill in your name, a short summary, and the full testimonial.');
      return;
    }
    if (photoFile && photoFile.size > MAX_PHOTO_BYTES) {
      setError('Photo must be 2 MB or smaller.');
      return;
    }
    setSubmitting(true);
    try {
      let photo = null;
      if (photoFile) photo = await fileToDataUrl(photoFile);
      await callFunction('submit-testimonial', {
        action: 'submit',
        token,
        name: name.trim(),
        title: title.trim(),
        project_name: project.trim(),
        summary: summary.trim(),
        body: body.trim(),
        tag_ids: Array.from(selectedTags),
        photo,
      });
      setPhase('done');
    } catch (e) {
      setError(e.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') return <div class="panel"><p>Checking your link…</p></div>;

  if (phase === 'error')
    return (
      <div class="panel">
        <div class="notice notice-error">{error}</div>
      </div>
    );

  if (phase === 'invalid')
    return (
      <div class="panel">
        <h2>Link not valid</h2>
        <div class="notice notice-error">
          {error || 'This testimonial link is missing, invalid, or has already been used.'}
        </div>
        <p>Please ask your contact to send a fresh invitation link.</p>
      </div>
    );

  if (phase === 'done')
    return (
      <div class="panel">
        <h2>🎉 Thank you!</h2>
        <div class="notice notice-success">
          Your testimonial has been submitted and is awaiting review. Once approved it will appear on
          the Wall of Fame.
        </div>
      </div>
    );

  return (
    <div class="panel">
      <h2>Share your story</h2>
      <p class="comment-meta">
        You were invited to add a testimonial. No account needed — just fill this out.
      </p>
      <form onSubmit={submit}>
        <div class="field">
          <label>Your name</label>
          <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} required />
        </div>
        <div class="field">
          <label>Role / title <span class="hint">(e.g. Senior Cloud Engineer)</span></label>
          <input type="text" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label>Project</label>
          <input type="text" value={project} onInput={(e) => setProject(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label>Profile photo <span class="hint">(optional, max 2 MB)</span></label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.currentTarget.files?.[0] || null)}
          />
        </div>
        <div class="field">
          <label>Short summary <span class="hint">(shown on the sticky note)</span></label>
          <textarea
            value={summary}
            maxLength={200}
            style={{ minHeight: '70px' }}
            onInput={(e) => setSummary(e.currentTarget.value)}
            required
          />
          <div class="comment-meta">{summary.length}/200</div>
        </div>
        <div class="field">
          <label>Full testimonial <span class="hint">(Markdown supported)</span></label>
          <textarea value={body} onInput={(e) => setBody(e.currentTarget.value)} required />
        </div>

        {Object.keys(grouped).length > 0 && (
          <div class="field">
            <label>Tags <span class="hint">(help clients find your skills)</span></label>
            {Object.keys(grouped).map((cat) => (
              <div class="filter-group" key={cat}>
                <div class="filter-group-label">{catLabel(cat)}</div>
                <div class="chips">
                  {grouped[cat].map((o) => (
                    <button
                      type="button"
                      key={o.id}
                      class={`chip ${selectedTags.has(o.id) ? 'active' : ''}`}
                      onClick={() => toggleTag(o.id)}
                    >
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
          {submitting ? 'Submitting…' : 'Submit testimonial'}
        </button>
      </form>
    </div>
  );
}
