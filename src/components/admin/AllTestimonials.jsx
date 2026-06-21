import { useState } from 'preact/hooks';
import Avatar from '../Avatar.jsx';
import TestimonialEditor from './TestimonialEditor.jsx';
import { setTestimonialStatus, deleteTestimonial } from '../../lib/adminData.js';

const BADGE = { pending: 'badge-pending', approved: 'badge-approved', archived: 'badge-archived' };

export default function AllTestimonials({ items, options, onChange }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);

  async function act(id, fn) {
    setBusy(id);
    try {
      await fn();
      await onChange();
    } finally {
      setBusy(null);
    }
  }

  const shown = filter === 'all' ? items : items.filter((t) => t.status === filter);

  return (
    <div>
      <div class="admin-tabs">
        {['all', 'approved', 'pending', 'archived'].map((f) => (
          <button key={f} class={`admin-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p class="comment-meta">Nothing here.</p>}

      {shown.map((t) => (
        <div key={t.id}>
          <div class="row">
            <Avatar person={t.person} />
            <div class="row-main">
              <strong>{t.person.name}</strong> <span class={`badge ${BADGE[t.status]}`}>{t.status}</span>
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
    </div>
  );
}
