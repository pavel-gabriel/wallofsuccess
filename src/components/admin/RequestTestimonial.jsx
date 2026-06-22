import { useState } from 'preact/hooks';
import { callFunction, readFunctionError } from '../../lib/functions.js';

// Admin-facing form that triggers the `request-testimonial` backend endpoint.
// callFunction attaches the logged-in admin's JWT, which the endpoint verifies
// (it also accepts an x-api-key for external apps — see the README).
//
// Two actions share the form:
//   • Send invitation  -> emails the one-time link (email required)
//   • Generate link     -> only creates the link and returns it to copy/share
//                          (email optional; same thing external apps call with
//                           `send: false`)
export default function RequestTestimonial() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  async function run(send) {
    setBusy(true);
    setResult(null);
    setLink('');
    setCopied(false);
    try {
      const data = await callFunction('request-testimonial', {
        name: name.trim(),
        email: email.trim(),
        project: project.trim(),
        send,
      });
      setLink(data?.link || '');
      setResult({
        ok: true,
        message: data?.message || (send ? `Invitation sent to ${email}.` : 'Link generated.'),
      });
      if (send) {
        setName('');
        setEmail('');
        setProject('');
      }
    } catch (e) {
      setResult({ ok: false, message: await readFunctionError(e, 'Could not create the request.') });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is selectable in the field */
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Invite someone to add a testimonial</h3>
      <p class="comment-meta">
        Email a one-time link, or just generate a link to share yourself. The recipient fills the
        form — no account needed.
      </p>
      <form onSubmit={(e) => e.preventDefault()} style={{ maxWidth: '480px' }}>
        <div class="field">
          <label>Name</label>
          <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label>Email <span class="hint">(required to email; optional to just generate a link)</span></label>
          <input type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label>Project <span class="hint">(optional, prefilled in their form)</span></label>
          <input type="text" value={project} onInput={(e) => setProject(e.currentTarget.value)} />
        </div>

        {result && (
          <div class={`notice ${result.ok ? 'notice-success' : 'notice-error'}`}>{result.message}</div>
        )}

        {link && (
          <div class="field">
            <label>One-time link</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" value={link} readonly onFocus={(e) => e.currentTarget.select()} />
              <button type="button" class="btn btn-secondary" onClick={copyLink}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button class="btn" type="button" disabled={busy} onClick={() => run(true)}>
            {busy ? 'Working…' : 'Send invitation'}
          </button>
          <button class="btn btn-secondary" type="button" disabled={busy} onClick={() => run(false)}>
            Generate link
          </button>
        </div>
      </form>
    </div>
  );
}
