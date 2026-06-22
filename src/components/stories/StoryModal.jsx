import { useEffect } from 'preact/hooks';
import { renderMarkdown } from '../../lib/util.js';
import { exportStoryPdf, exportStoryPptx } from '../../lib/storyExport.js';

export default function StoryModal({ story, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!story) return null;
  const client = story.clientName || story.clientAlias || 'Client';

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2>{story.title}</h2>
            <div class="sub">
              {client}
              {story.industry ? ` · ${story.industry}` : ''}
              {story.duration ? ` · ${story.duration}` : ''}
            </div>
          </div>
          <button class="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div class="modal-body">
          {story.metrics?.length > 0 && (
            <div class="story-metrics-grid">
              {story.metrics.map((m, i) => (
                <div class="story-metric-box" key={i}>
                  <strong>{m.value}</strong>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          )}

          {story.summary && <p class="story-lead">{story.summary}</p>}

          {story.challenge && (
            <section class="story-section">
              <h3>Challenge</h3>
              <div class="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(story.challenge) }} />
            </section>
          )}
          {story.solution && (
            <section class="story-section">
              <h3>Solution</h3>
              <div class="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(story.solution) }} />
            </section>
          )}
          {story.results && (
            <section class="story-section">
              <h3>Results</h3>
              <div class="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(story.results) }} />
            </section>
          )}

          {story.contributors?.length > 0 && (
            <section class="story-section">
              <h3>Team</h3>
              <ul class="story-contributors">
                {story.contributors.map((c, i) => (
                  <li key={i}>
                    <strong>{c.name || 'Contributor'}</strong>
                    {c.role ? ` — ${c.role}` : ''}
                    {c.contribution ? <div class="comment-meta">{c.contribution}</div> : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {story.tags?.length > 0 && (
            <div class="modal-tags">
              {story.tags.map((t) => (
                <span class="tag" key={t.id}>{t.value}</span>
              ))}
            </div>
          )}

          <div class="story-export">
            <button class="btn btn-sm" onClick={() => exportStoryPdf(story)}>Download PDF</button>
            <button class="btn btn-sm btn-secondary" onClick={() => exportStoryPptx(story)}>Download slide (.pptx)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
