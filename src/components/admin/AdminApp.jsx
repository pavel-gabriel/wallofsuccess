import { useEffect, useState } from 'preact/hooks';
import { isConfigured } from '../../lib/data.js';
import { getSession, signIn, signOut } from '../../lib/adminData.js';
import { fetchAllTestimonials, fetchFilterOptions, fetchSettings } from '../../lib/data.js';
import PendingQueue from './PendingQueue.jsx';
import AllTestimonials from './AllTestimonials.jsx';
import CommentsModeration from './CommentsModeration.jsx';
import FilterOptionsManager from './FilterOptionsManager.jsx';
import SettingsManager from './SettingsManager.jsx';
import RequestTestimonial from './RequestTestimonial.jsx';
import StoriesManager from './StoriesManager.jsx';

const TABS = [
  ['pending', 'Pending'],
  ['all', 'All testimonials'],
  ['stories', 'Success stories'],
  ['comments', 'Comments'],
  ['request', 'Request testimonial'],
  ['filters', 'Filter options'],
  ['settings', 'Settings'],
];

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState('pending');

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
    if (session) reload();
  }, [session]);

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

  const pending = testimonials.filter((t) => t.status === 'pending');

  return (
    <div class="panel panel-wide">
      <div class="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
        <div class="row-main">
          <h2 style={{ margin: 0 }}>Admin dashboard</h2>
          <div class="comment-meta">{session.user?.email}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-secondary" onClick={async () => { await signOut(); setSession(null); }}>
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
            {key === 'pending' && pending.length > 0 ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      {dataError && <div class="notice notice-error">{dataError}</div>}

      {tab === 'pending' && (
        <PendingQueue items={pending} options={options} onChange={reload} />
      )}
      {tab === 'all' && (
        <AllTestimonials items={testimonials} options={options} onChange={reload} />
      )}
      {tab === 'stories' && <StoriesManager options={options} />}
      {tab === 'comments' && <CommentsModeration testimonials={testimonials} />}
      {tab === 'request' && <RequestTestimonial />}
      {tab === 'filters' && <FilterOptionsManager options={options} onChange={reload} />}
      {tab === 'settings' && <SettingsManager settings={settings} onChange={reload} />}
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
