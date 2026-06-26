import { useEffect, useState } from 'preact/hooks';
import { isConfigured } from '../../lib/data.js';
import { getSession, signIn, signOut, isAdmin } from '../../lib/adminData.js';
import { fetchAllTestimonials, fetchFilterOptions, fetchSettings } from '../../lib/data.js';
import AllTestimonials from './AllTestimonials.jsx';
import CommentsModeration from './CommentsModeration.jsx';
import SettingsManager from './SettingsManager.jsx';
import StoriesManager from './StoriesManager.jsx';

const TABS = [
  ['all', 'All testimonials'],
  ['stories', 'Success stories'],
  ['comments', 'Comments'],
  ['settings', 'Settings'],
];

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(null); // null = unknown, false = not an admin
  const [tab, setTab] = useState('all');

  // shared data
  const [testimonials, setTestimonials] = useState([]);
  const [options, setOptions] = useState([]);
  const [settings, setSettings] = useState({});
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    if (!isConfigured) {
      setChecking(false);
      return;
    }
    getSession()
      .then((s) => setSession(s))
      .finally(() => setChecking(false));
  }, []);

  async function reload() {
    try {
      const [t, o, s] = await Promise.all([
        fetchAllTestimonials(),
        fetchFilterOptions(),
        fetchSettings(),
      ]);
      setTestimonials(t);
      setOptions(o);
      setSettings(s);
      setDataError('');
    } catch (e) {
      setDataError(e.message || 'Failed to load admin data.');
    }
  }

  useEffect(() => {
    if (!session) return;
    let alive = true;
    isAdmin()
      .then((ok) => alive && setAuthorized(ok))
      .catch(() => alive && setAuthorized(false));
    reload();
    return () => { alive = false; };
  }, [session]);

  async function handleSignOut() {
    await signOut();
    setAuthorized(null);
    setSession(null);
  }

  if (!isConfigured)
    return (
      <div class="panel">
        <div class="notice notice-info">
          Backend not reachable. Make sure the API server is running (see the README).
        </div>
      </div>
    );

  if (checking) return <div class="panel"><p>Checking session…</p></div>;
  if (!session) return <LoginForm onLogin={setSession} />;

  if (authorized === null) return <div class="panel"><p>Checking access…</p></div>;
  if (authorized === false)
    return (
      <div class="panel" style={{ maxWidth: '480px' }}>
        <h2>No admin access</h2>
        <div class="notice notice-error">
          You’re signed in as <strong>{session.user?.email}</strong>, but this account isn’t an
          administrator. Ask an existing admin to grant access, then sign in again.
        </div>
        <button class="btn btn-sm btn-secondary" onClick={handleSignOut}>Sign out</button>
      </div>
    );

  const moderationOn = settings.comment_moderation === 'on' || settings.comment_moderation === true;

  return (
    <div class="panel panel-wide">
      <div class="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
        <div class="row-main">
          <h2 style={{ margin: 0 }}>Admin dashboard</h2>
          <div class="comment-meta">{session.user?.email}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-secondary" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>

      <div class="admin-tabs" style={{ marginTop: '1rem' }}>
        {TABS.map(([key, lbl]) => (
          <button
            key={key}
            class={`admin-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {lbl}
          </button>
        ))}
      </div>

      {dataError && <div class="notice notice-error">{dataError}</div>}

      {tab === 'all' && (
        <AllTestimonials items={testimonials} options={options} moderationOn={moderationOn} onChange={reload} />
      )}
      {tab === 'stories' && <StoriesManager options={options} />}
      {tab === 'comments' && <CommentsModeration testimonials={testimonials} />}
      {tab === 'settings' && <SettingsManager settings={settings} options={options} onChange={reload} />}
    </div>
  );
}

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const s = await signIn(email.trim(), password);
      onLogin(s);
    } catch (e) {
      setError(e.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="panel" style={{ maxWidth: '420px' }}>
      <h2>Admin login</h2>
      <form onSubmit={submit}>
        <div class="field">
          <label>Email</label>
          <input type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required />
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" value={password} onInput={(e) => setPassword(e.currentTarget.value)} required />
        </div>
        {error && <div class="notice notice-error">{error}</div>}
        <button class="btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
