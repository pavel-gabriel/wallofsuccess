import { useEffect, useState } from 'preact/hooks';
import Avatar from '../Avatar.jsx';
import TestimonialModal from '../TestimonialModal.jsx';
import { renderMarkdown, formatPeriod } from '../../lib/util.js';
import { fetchTestimonialsByProject } from '../../lib/data.js';
import { exportStoryPdf, exportStoryPptx } from '../../lib/storyExport.js';

const PER_PAGE = 4;

export default function StoryModal({ group, onClose }) {
  const versions = group?.versions || [];
  const [selected, setSelected] = useState(0);
  const [winStart, setWinStart] = useState(0); // first version chip shown (window of 2)
  const [people, setPeople] = useState([]);
  const [page, setPage] = useState(0);
  const [openGroup, setOpenGroup] = useState(null);
  const story = versions[selected];
  const WIN = 2;

  // Reset to the latest version whenever a different project opens.
  useEffect(() => {
    setSelected(0);
    setWinStart(0);
  }, [group?.key]);

  useEffect(() => {
    // Let the nested testimonial modal own Escape while it is open.
    const onKey = (e) => e.key === 'Escape' && !openGroup && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, openGroup]);

  // Reload the people who worked on the selected version — only testimonials
  // whose period sits inside that version's period.
  useEffect(() => {
    let alive = true;
    setPeople([]);
    setPage(0);
    if (story?.projectName) {
      fetchTestimonialsByProject(story.projectName, { start: story.periodStart, end: story.periodEnd })
        .then((t) => alive && setPeople(t))
        .catch(() => alive && setPeople([]));
    }
    return () => {
      alive = false;
    };
  }, [story?.projectName, story?.periodStart, story?.periodEnd]);

  if (!story) return null;
  const client = story.clientName || story.clientAlias || 'Client';
  const pageCount = Math.ceil(people.length / PER_PAGE);
  const shown = people.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  // Keep the grid a constant 4 cells across pages so the modal doesn't resize.
  const cells = pageCount > 1
    ? [...shown, ...Array(PER_PAGE - shown.length).fill(null)]
    : shown;

  return (
    <>
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2>{story.title}</h2>
            <div class="sub">
              {client}
              {story.industry ? ` · ${story.industry}` : ''}
              {formatPeriod(story.periodStart, story.periodEnd)
                ? ` · ${formatPeriod(story.periodStart, story.periodEnd)}`
                : ''}
            </div>
          </div>
          <button class="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {versions.length > 1 && (
          <div class="story-versions">
            <span class="comment-meta">Implementation:</span>
            {versions.length > WIN && (
              <button
                class="btn btn-sm btn-secondary story-versions-arrow"
                disabled={winStart === 0}
                aria-label="Earlier implementations"
                onClick={() => setWinStart((w) => Math.max(0, w - 1))}
              >‹</button>
            )}
            {versions.slice(winStart, winStart + WIN).map((v, i) => {
              const idx = winStart + i;
              return (
                <button
                  key={v.id}
                  class={`btn btn-sm ${idx === selected ? '' : 'btn-secondary'}`}
                  onClick={() => setSelected(idx)}
                >
                  {formatPeriod(v.periodStart, v.periodEnd) || 'Timeframe NA'}
                </button>
              );
            })}
            {versions.length > WIN && (
              <button
                class="btn btn-sm btn-secondary story-versions-arrow"
                disabled={winStart + WIN >= versions.length}
                aria-label="Later implementations"
                onClick={() => setWinStart((w) => Math.min(versions.length - WIN, w + 1))}
              >›</button>
            )}
          </div>
        )}

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

          {people.length > 0 && (
            <section class="story-section story-people">
              <h3>Worked on this project ({people.length})</h3>
              <div class="story-people-grid">
                {cells.map((t, i) =>
                  t ? (
                    <div class="story-person" key={t.id}>
                      <div class="story-person-head">
                        <Avatar person={t.person} />
                        <div class="story-person-main">
                          <button
                            class="link-btn story-person-name"
                            onClick={() => setOpenGroup({ person: t.person, items: [t] })}
                          >
                            {t.person.name}
                          </button>
                          <div class="comment-meta">{t.person.title}</div>
                        </div>
                      </div>
                      <p class="story-person-summary">{t.summary}</p>
                    </div>
                  ) : (
                    <div class="story-person is-empty" aria-hidden="true" key={`empty-${i}`} />
                  )
                )}
              </div>
              {pageCount > 1 && (
                <div class="story-people-pager">
                  <button class="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                  <span class="comment-meta">Page {page + 1} of {pageCount}</span>
                  <button class="btn btn-sm btn-secondary" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next ›</button>
                </div>
              )}
            </section>
          )}

          <div class="story-export">
            <button class="btn btn-sm" onClick={() => exportStoryPdf(story)}>Download PDF</button>
            <button class="btn btn-sm btn-secondary" onClick={() => exportStoryPptx(story)}>Download slide (.pptx)</button>
          </div>
        </div>
      </div>
    </div>

    {openGroup && (
      <TestimonialModal group={openGroup} moderationOn={false} onClose={() => setOpenGroup(null)} />
    )}
    </>
  );
}
