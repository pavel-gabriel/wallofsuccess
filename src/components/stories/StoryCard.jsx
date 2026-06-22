// A project/client success-story card. Public cards show the client alias;
// admin/internal views may also carry the real clientName.
export default function StoryCard({ story, onOpen }) {
  const headline = story.metrics?.[0];
  return (
    <article
      class="story-card"
      onClick={() => onOpen(story)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(story)}
    >
      <div class="story-card-top">
        {story.industry && <span class="story-industry">{story.industry}</span>}
        {story.duration && <span class="story-duration">{story.duration}</span>}
      </div>
      <h3 class="story-title">{story.title}</h3>
      <div class="story-client">
        {story.clientName ? (
          <>
            {story.clientName}
            <span class="story-internal" title="Internal full detail">internal</span>
          </>
        ) : (
          story.clientAlias || 'Client'
        )}
      </div>
      {story.summary && <p class="story-summary">{story.summary}</p>}
      {headline && (
        <div class="story-metric">
          <strong>{headline.value}</strong> <span>{headline.label}</span>
        </div>
      )}
      {story.tags?.length > 0 && (
        <div class="note-footer">
          {story.tags.slice(0, 4).map((t) => (
            <span class="tag" key={t.id}>{t.value}</span>
          ))}
          {story.tags.length > 4 && <span class="tag">+{story.tags.length - 4}</span>}
        </div>
      )}
    </article>
  );
}
