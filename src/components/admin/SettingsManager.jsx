import { useState } from 'preact/hooks';
import { upsertSetting, changePassword } from '../../lib/adminData.js';
import FilterOptionsManager from './FilterOptionsManager.jsx';

export default function SettingsManager({ settings, options, onChange }) {
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

      <hr style={{ margin: '1.5rem 0', border: 0, borderTop: '1px solid var(--line)' }} />
      <ChangePassword />

      <hr style={{ margin: '1.5rem 0', border: 0, borderTop: '1px solid var(--line)' }} />
      <h3>Filter options</h3>
      <FilterOptionsManager options={options} onChange={onChange} />
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: 'New password must be at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: 'New password and confirmation don’t match.' });
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setMsg({ ok: true, text: 'Password changed.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Could not change the password.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: '420px' }}>
      <h3 style={{ marginTop: 0 }}>Change password</h3>
      <div class="field">
        <label>Current password</label>
        <input type="password" value={current} onInput={(e) => setCurrent(e.currentTarget.value)} required />
      </div>
      <div class="field">
        <label>New password <span class="hint">(at least 8 characters)</span></label>
        <input type="password" value={next} onInput={(e) => setNext(e.currentTarget.value)} required />
      </div>
      <div class="field">
        <label>Confirm new password</label>
        <input type="password" value={confirm} onInput={(e) => setConfirm(e.currentTarget.value)} required />
      </div>
      {msg && <div class={`notice ${msg.ok ? 'notice-success' : 'notice-error'}`}>{msg.text}</div>}
      <button class="btn btn-sm" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
