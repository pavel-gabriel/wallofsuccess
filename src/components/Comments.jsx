import { useEffect, useState } from 'preact/hooks';
import { fetchComments, postComment } from '../lib/data.js';
import { formatDate } from '../lib/util.js';

export default function Comments({ testimonialId, moderationOn }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'error'

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchComments(testimonialId)
      .then((c) => alive && setComments(c))
      .catch(() => alive && setComments([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [testimonialId]);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim() || !name.trim()) return;
    setStatus('sending');
    // The server's trigger sets status to 'visible' unless moderation is on, in
    // which case it's stored 'pending' and won't appear until approved.
    try {
      const created = await postComment(testimonialId, {
        author_name: name.trim().slice(0, 80),
        body: body.trim().slice(0, 2000),
      });
      setStatus('ok');
      setBody('');
      if (created && created.status === 'visible') {
        setComments((prev) => [...prev, created]);
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div class="comments">
      <h3>Comments {comments.length ? `(${comments.length})` : ''}</h3>
      {loading ? (
        <p class="comment-meta">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p class="comment-meta">No comments yet. Be the first to leave a note.</p>
      ) : (
        comments.map((c) => (
          <div class="comment" key={c.id}>
            <div class="comment-meta">
              <strong>{c.author_name}</strong> · {formatDate(c.created_at)}
            </div>
            <div class="comment-body">{c.body}</div>
          </div>
        ))
      )}

      <form class="comment-form" onSubmit={submit}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          maxLength={80}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
        <textarea
          placeholder="Add a comment…"
          value={body}
          maxLength={2000}
          style={{ minHeight: '70px' }}
          onInput={(e) => setBody(e.currentTarget.value)}
          required
        />
        <div>
          <button class="btn btn-sm" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Posting…' : 'Post comment'}
          </button>
        </div>
        {status === 'ok' && (
          <p class="notice notice-success" style={{ margin: '0.25rem 0 0' }}>
            {moderationOn ? 'Thanks! Your comment is awaiting approval.' : 'Comment posted.'}
          </p>
        )}
        {status === 'error' && (
          <p class="notice notice-error" style={{ margin: '0.25rem 0 0' }}>
            Could not post your comment. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
