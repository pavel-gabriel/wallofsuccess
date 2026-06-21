import Avatar from './Avatar.jsx';
import { noteColor, noteTilt } from '../lib/util.js';

// `group` = { person, items: [...] }
export default function StickyNote({ group, onOpen }) {
  const { person, items } = group;
  const primary = items[0];
  const color = noteColor(person.id);
  const tilt = noteTilt(person.id);

  // Collect a few distinct tags across this person's testimonials.
  const tags = [];
  const seen = new Set();
  for (const it of items) {
    for (const t of it.tags || []) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        tags.push(t);
      }
    }
  }

  return (
    <article
      class={`note ${color}`}
      style={{ transform: `rotate(${tilt}deg)` }}
      onClick={() => onOpen(group)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(group)}
    >
      {items.length > 1 && <span class="note-count">{items.length} testimonials</span>}
      <div class="note-head">
        <Avatar person={person} />
        <div>
          <div class="note-name">{person.name}</div>
          <div class="note-title">{person.title}</div>
        </div>
      </div>
      <div class="note-summary">{primary.summary}</div>
      {tags.length > 0 && (
        <div class="note-footer">
          {tags.slice(0, 4).map((t) => (
            <span class="tag" key={t.id}>{t.value}</span>
          ))}
          {tags.length > 4 && <span class="tag">+{tags.length - 4}</span>}
        </div>
      )}
    </article>
  );
}
