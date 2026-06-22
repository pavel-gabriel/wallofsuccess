import { useEffect, useState } from 'preact/hooks';
import { fetchAllSuccessStories, updateStory, deleteStory } from '../../lib/adminData.js';
import { callFunction, readFunctionError } from '../../lib/functions.js';
import { exportStoryPdf, exportStoryPptx } from '../../lib/storyExport.js';
import StoryEditor from './StoryEditor.jsx';

const BADGE = { pending: 'badge-pending', approved: 'badge-approved', archived: 'badge-archived' };

export default function StoriesManager({ options }) {
  const [stories, setStories] = useState([]);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // id | 'new' | null
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function reload() {
    try {
      setStories(await fetchAllSuccessStories());
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load stories.');
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function act(id, fn) {
    setBusy(id);
    try {
      await fn();
      await reload();
    } finally {
      setBusy(null);
    }
  }

  const shown = filter === 'all' ? stories : stories.filter((s) => s.status === filter);

  return (
    <div>
      <div class="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
        <div class="row-main">
          <StoryInvite />
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" onClick={() => setEditing(editing === 'new' ? null : 'new')}>
            {editing === 'new' ? 'Close' : '+ New story'}
          </button>
        </div>
      </div>

      {editing === 'new' && (
        <StoryEditor options={options} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />
      )}

      <div class="admin-tabs" style={{ marginTop: '1rem' }}>
        {['all', 'pending', 'approved', 'archived'].map((s) => (
          <button key={s} class={`admin-tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <p class="comment-meta" style={{ marginTop: '0.5rem' }}>
        Stories appear on the public Success Stories page only when <strong>Published</strong> (approved&nbsp;+&nbsp;public).
      </p>
      {error && <div class="notice notice-error">{error}</div>}
      {shown.length === 0 && <p class="comment-meta">Nothing here.</p>}

      {shown.map((s) => (
        <div key={s.id}>
          <div class="row">
            <div class="row-main">
              <strong>{s.title}</strong> <span class={`badge ${BADGE[s.status]}`}>{s.status}</span>
              {s.isPublic ? <span class="badge badge-approved" title="Visible publicly (anonymized)">public</span> : <span class="badge badge-archived">internal</span>}
              <div class="comment-meta">
                {s.clientName || s.clientAlias || '—'}{s.industry ? ` · ${s.industry}` : ''}
              </div>
              {s.summary && <p style={{ margin: '0.4rem 0' }}>{s.summary}</p>}
            </div>
            <div class="row-actions">
              {s.status !== 'approved' && (
                <button class="btn btn-sm" disabled={busy === s.id} onClick={() => act(s.id, () => updateStory(s.id, { status: 'approved' }))}>Approve</button>
              )}
              {s.status === 'approved' && (
                <button class="btn btn-sm btn-secondary" disabled={busy === s.id} onClick={() => act(s.id, () => updateStory(s.id, { status: 'archived' }))}>Archive</button>
              )}
              <button class="btn btn-sm" disabled={busy === s.id}
                onClick={() => act(s.id, () => updateStory(s.id, s.isPublic ? { is_public: false } : { is_public: true, status: 'approved' }))}>
                {s.isPublic ? 'Unpublish' : 'Publish'}
              </button>
              <button class="btn btn-sm btn-secondary" onClick={() => setEditing(editing === s.id ? null : s.id)}>{editing === s.id ? 'Close' : 'Edit'}</button>
              <button class="btn btn-sm btn-secondary" onClick={() => exportStoryPdf(s)}>PDF</button>
              <button class="btn btn-sm btn-secondary" onClick={() => exportStoryPptx(s)}>Slide</button>
              <button class="btn btn-sm btn-danger" disabled={busy === s.id}
                onClick={() => confirm('Delete this success story permanently?') && act(s.id, () => deleteStory(s.id))}>Delete</button>
            </div>
          </div>
          {editing === s.id && (
            <StoryEditor story={s} options={options} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />
          )}
        </div>
      ))}
    </div>
  );
}

// Compact invite: generate or email a one-time story link.
function StoryInvite() {
  const [clientName, setClientName] = useState('');
  const [project, setProject] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  async function run(send) {
    setBusy(true);
    setResult(null);
    setLink('');
    setCopied(false);
    try {
      const data = await callFunction('request-story', { client_name: clientName.trim(), project: project.trim(), email: email.trim(), send });
      setLink(data?.link || '');
      setResult({ ok: true, message: send ? (data?.sent ? `Invitation emailed to ${email}.` : 'Email isn’t configured — copy the link below.') : 'Link generated — copy it below.' });
    } catch (e) {
      setResult({ ok: false, message: await readFunctionError(e, 'Could not create the request.') });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is selectable in the field */
    }
  }

  return (
    <div>
      <strong>Invite someone to add a success story</strong>
      <div class="row-inline" style={{ marginTop: '0.5rem' }}>
        <input type="text" placeholder="Client (internal)" value={clientName} onInput={(e) => setClientName(e.currentTarget.value)} />
        <input type="text" placeholder="Project" value={project} onInput={(e) => setProject(e.currentTarget.value)} />
        <input type="email" placeholder="Email (to send)" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
      </div>
      <div class="row-actions" style={{ marginTop: '0.5rem' }}>
        <button class="btn btn-sm" type="button" disabled={busy} onClick={() => run(true)}>{busy ? 'Working…' : 'Send invite'}</button>
        <button class="btn btn-sm btn-secondary" type="button" disabled={busy} onClick={() => run(false)}>Generate link</button>
      </div>
      {result && <div class={`notice ${result.ok ? 'notice-success' : 'notice-error'}`} style={{ marginTop: '0.5rem' }}>{result.message}</div>}
      {link && (
        <div class="row-inline" style={{ marginTop: '0.4rem' }}>
          <input type="text" value={link} readonly onFocus={(e) => e.currentTarget.select()} />
          <button type="button" class="btn btn-secondary" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
