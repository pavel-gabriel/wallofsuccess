import { useMemo, useState } from 'preact/hooks';
import Avatar from '../Avatar.jsx';
import TestimonialEditor from './TestimonialEditor.jsx';
import TestimonialModal from '../TestimonialModal.jsx';
import RequestTestimonial from './RequestTestimonial.jsx';
import { setTestimonialStatus, updateTestimonial, deleteTestimonial } from '../../lib/adminData.js';

const BADGE = { pending: 'badge-pending', approved: 'badge-approved', archived: 'badge-archived' };

export default function AllTestimonials({ items, options, moderationOn, onChange }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [preview, setPreview] = useState(null); // testimonial opened read-only

  async function act(id, fn) {
    setBusy(id);
    try {
      await fn();
      await onChange();
    } finally {
      setBusy(null);
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false;
      if (!q) return true;
      return `${t.person?.name || ''} ${t.person?.title || ''} ${t.projectName || ''} ${t.summary || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, filter, query]);

  return (
    <div>
      <div class="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
        <div class="row-main">
          <strong>Testimonials</strong>
          <div class="comment-meta">Review and edit testimonials, or invite someone to add one.</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" onClick={() => setRequesting((v) => !v)}>
            {requesting ? 'Close' : '+ Request testimonial'}
          </button>
        </div>
      </div>

      {requesting && (
        <div style={{ marginTop: '1rem' }}>
          <RequestTestimonial />
        </div>
      )}

      <div class="admin-tabs" style={{ marginTop: '1rem' }}>
        {['all', 'approved', 'pending', 'archived'].map((f) => (
          <button key={f} class={`admin-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <input
        type="search"
        class="filter-search"
        style={{ margin: '0.75rem 0' }}
        placeholder="Search testimonials…"
        value={query}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />

      {shown.length === 0 && <p class="comment-meta">Nothing here.</p>}

      {shown.map((t) => (
        <div key={t.id}>
          <div class="row">
            <Avatar person={t.person} />
            <div class="row-main">
              <button class="link-btn" style={{ fontWeight: 700 }} onClick={() => setPreview(t)}>
                {t.person.name}
              </button>{' '}
              <span class={`badge ${BADGE[t.status]}`}>{t.status}</span>
              {t.pinned && <span class="badge badge-approved" title="Shown first on the wall">pinned</span>}
              <div class="comment-meta">{t.person.title}{t.projectName ? ` · ${t.projectName}` : ''}</div>
              <p style={{ margin: '0.4rem 0' }}>{t.summary}</p>
            </div>
            <div class="row-actions">
              {t.status !== 'approved' && (
                <button class="btn btn-sm" disabled={busy === t.id}
                  onClick={() => act(t.id, () => setTestimonialStatus(t.id, 'approved'))}>Approve</button>
              )}
              {t.status === 'approved' && (
                <button class="btn btn-sm btn-secondary" disabled={busy === t.id}
                  onClick={() => act(t.id, () => setTestimonialStatus(t.id, 'archived'))}>Archive</button>
              )}
              <button class="btn btn-sm btn-secondary" disabled={busy === t.id}
                onClick={() => act(t.id, () => updateTestimonial(t.id, { pinned: !t.pinned }))}>
                {t.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button class="btn btn-sm btn-secondary"
                onClick={() => setEditing(editing === t.id ? null : t.id)}>
                {editing === t.id ? 'Close' : 'Edit'}
              </button>
              <button class="btn btn-sm btn-danger" disabled={busy === t.id}
                onClick={() => confirm('Delete this testimonial permanently?') &&
                  act(t.id, () => deleteTestimonial(t.id))}>Delete</button>
            </div>
          </div>
          {editing === t.id && (
            <TestimonialEditor
              testimonial={t}
              options={options}
              onCancel={() => setEditing(null)}
              onSaved={async () => { setEditing(null); await onChange(); }}
            />
          )}
        </div>
      ))}

      {preview && (
        <TestimonialModal
          group={{ person: preview.person, items: [preview] }}
          moderationOn={moderationOn}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
