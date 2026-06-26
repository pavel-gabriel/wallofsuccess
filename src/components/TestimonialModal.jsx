import { useEffect, useState } from 'preact/hooks';
import Avatar from './Avatar.jsx';
import Comments from './Comments.jsx';
import { renderMarkdown, formatDate, formatPeriod } from '../lib/util.js';

// `group` = { person, items: [testimonial, ...] }
export default function TestimonialModal({ group, moderationOn, onClose }) {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!group) return null;
  const { person, items } = group;
  const active = items[Math.min(tab, items.length - 1)];

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <Avatar person={person} />
          <div>
            <h2>{person.name}</h2>
            <div class="sub">{person.title}</div>
          </div>
          <button class="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {items.length > 1 && (
          <div class="modal-tabs">
            {items.map((it, i) => (
              <button
                key={it.id}
                class={`modal-tab ${i === tab ? 'active' : ''}`}
                onClick={() => setTab(i)}
              >
                {it.projectName || `Testimonial ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        <div class="modal-body" key={active.id}>
          {active.projectName && (
            <div class="testimonial-project">
              {active.projectName}
              {formatPeriod(active.periodStart, active.periodEnd) && (
                <span class="testimonial-period"> · {formatPeriod(active.periodStart, active.periodEnd)}</span>
              )}
            </div>
          )}
          <div
            class="prose"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(active.body || active.summary) }}
          />
          {active.tags?.length > 0 && (
            <div class="modal-tags">
              {active.tags.map((t) => (
                <span class="tag" key={t.id}>{t.value}</span>
              ))}
            </div>
          )}
          {active.approvedAt && (
            <div class="comment-meta">Added {formatDate(active.approvedAt)}</div>
          )}
          <Comments testimonialId={active.id} moderationOn={moderationOn} />
        </div>
      </div>
    </div>
  );
}
