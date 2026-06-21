import { useState } from 'preact/hooks';
import Avatar from '../Avatar.jsx';
import TestimonialEditor from './TestimonialEditor.jsx';
import { setTestimonialStatus, deleteTestimonial } from '../../lib/adminData.js';
import { renderMarkdown } from '../../lib/util.js';

export default function PendingQueue({ items, options, onChange }) {
  const [editing, setEditing] = useState(null);
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

  if (items.length === 0)
    return <p class="comment-meta">No pending testimonials. All caught up! 🎉</p>;

  return (
    <div>
      {items.map((t) => (
        <div key={t.id}>
          <div class="row">
            <Avatar person={t.person} />
            <div class="row-main">
              <strong>{t.person.name}</strong> <span class="badge badge-pending">pending</span>
              <div class="comment-meta">{t.person.title}{t.projectName ? ` · ${t.projectName}` : ''}</div>
              <p style={{ margin: '0.4rem 0' }}>{t.summary}</p>
              <div class="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(t.body) }} />
              {t.tags?.length > 0 && (
                <div class="modal-tags">{t.tags.map((x) => <span class="tag" key={x.id}>{x.value}</span>)}</div>
              )}
            </div>
            <div class="row-actions">
              <button class="btn btn-sm" disabled={busy === t.id}
                onClick={() => act(t.id, () => setTestimonialStatus(t.id, 'approved'))}>
                Approve
              </button>
              <button class="btn btn-sm btn-secondary"
                onClick={() => setEditing(editing === t.id ? null : t.id)}>
                {editing === t.id ? 'Close' : 'Edit'}
              </button>
              <button class="btn btn-sm btn-secondary" disabled={busy === t.id}
                onClick={() => act(t.id, () => setTestimonialStatus(t.id, 'archived'))}>
                Reject
              </button>
              <button class="btn btn-sm btn-danger" disabled={busy === t.id}
                onClick={() => confirm('Delete this submission permanently?') &&
                  act(t.id, () => deleteTestimonial(t.id))}>
                Delete
              </button>
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
