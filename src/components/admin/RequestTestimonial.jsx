import { useState } from 'preact/hooks';
import { supabase } from '../../lib/supabase.js';

// Admin-facing form that triggers the `request-testimonial` Edge Function.
// supabase.functions.invoke attaches the logged-in admin's JWT, which the
// function verifies (the same endpoint also accepts an x-api-key for external
// apps — see the README).
export default function RequestTestimonial() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('request-testimonial', {
        body: { name: name.trim(), email: email.trim(), project: project.trim() },
      });
      if (error) throw error;
      setResult({ ok: true, message: data?.message || `Invitation sent to ${email}.` });
      setName('');
      setEmail('');
      setProject('');
    } catch (e) {
      setResult({ ok: false, message: e.message || 'Could not send invitation.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Invite someone to add a testimonial</h3>
      <p class="comment-meta">
        Sends an email with a one-time link. The recipient fills the form — no account needed.
      </p>
      <form onSubmit={submit} style={{ maxWidth: '480px' }}>
        <div class="field">
          <label>Name</label>
          <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} required />
        </div>
        <div class="field">
          <label>Email</label>
          <input type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required />
        </div>
        <div class="field">
          <label>Project <span class="hint">(optional, prefilled in their form)</span></label>
          <input type="text" value={project} onInput={(e) => setProject(e.currentTarget.value)} />
        </div>
        {result && (
          <div class={`notice ${result.ok ? 'notice-success' : 'notice-error'}`}>{result.message}</div>
        )}
        <button class="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send invitation'}</button>
      </form>
    </div>
  );
}
