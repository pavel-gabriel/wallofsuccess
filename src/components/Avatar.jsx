import { initials } from '../lib/util.js';

export default function Avatar({ person, className = 'avatar' }) {
  if (person?.photo_url) {
    return <img class={className} src={person.photo_url} alt={person.name} />;
  }
  return <div class={className}>{initials(person?.name || '?')}</div>;
}
