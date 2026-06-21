import { useState } from 'preact/hooks';
import { upsertSetting } from '../../lib/adminData.js';

export default function SettingsManager({ settings, onChange }) {
  const [moderation, setModeration] = useState(
    settings.comment_moderation === 'on' || settings.comment_moderation === true,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      await upsertSetting('comment_moderation', moderation ? 'on' : 'off');
      await onChange();
      setMsg('Saved.');
    } catch (e) {
      setMsg(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Page settings</h3>
      <div class="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={moderation}
            style={{ width: 'auto' }}
            onChange={(e) => setModeration(e.currentTarget.checked)}
          />
          Require approval for new comments before they appear
        </label>
        <div class="comment-meta">
          When on, visitor comments are held as “pending” until you approve them under the Comments tab.
        </div>
      </div>
      {msg && <div class="notice notice-info">{msg}</div>}
      <button class="btn btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
    </div>
  );
}
