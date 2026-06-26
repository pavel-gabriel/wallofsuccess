import { useEffect, useState } from 'preact/hooks';
import { fetchAllComments, setCommentStatus, deleteComment } from '../../lib/adminData.js';
import { formatDate } from '../../lib/util.js';

export default function CommentsModeration({ testimonials }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const nameById = {};
  for (const t of testimonials) nameById[t.id] = t.person?.name || t.summary?.slice(0, 30);

  async function load() {
    setLoading(true);
    try {
      setComments(await fetchAllComments());
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(fn) {
    await fn();
    await load();
  }

  if (loading) return <p class="comment-meta">Loading comments…</p>;
  if (error) return <div class="notice notice-error">{error}</div>;
  if (comments.length === 0) return <p class="comment-meta">No comments yet.</p>;

  const q = query.trim().toLowerCase();
  const shown = !q
    ? comments
    : comments.filter((c) =>
        `${c.author_name || ''} ${c.body || ''} ${nameById[c.testimonial_id] || ''}`
          .toLowerCase()
          .includes(q),
      );

  return (
    <div>
      <input
        type="search"
        class="filter-search"
        style={{ marginBottom: '0.75rem' }}
        placeholder="Search comments…"
        value={query}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />
      {shown.length === 0 && <p class="comment-meta">No comments match your search.</p>}
      {shown.map((c) => (
        <div class="row" key={c.id}>
          <div class="row-main">
            <strong>{c.author_name}</strong>{' '}
            <span class={`badge ${c.status === 'visible' ? 'badge-approved' : 'badge-pending'}`}>{c.status}</span>
            <div class="comment-meta">
              on “{nameById[c.testimonial_id] || c.testimonial_id}” · {formatDate(c.created_at)}
            </div>
            <div class="comment-body">{c.body}</div>
          </div>
          <div class="row-actions">
            {c.status !== 'visible' ? (
              <button class="btn btn-sm" onClick={() => act(() => setCommentStatus(c.id, 'visible'))}>Show</button>
            ) : (
              <button class="btn btn-sm btn-secondary" onClick={() => act(() => setCommentStatus(c.id, 'hidden'))}>Hide</button>
            )}
            <button class="btn btn-sm btn-danger"
              onClick={() => confirm('Delete this comment?') && act(() => deleteComment(c.id))}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
