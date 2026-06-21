// Edge Function: create a one-time testimonial invite and email it.
// Two ways to authenticate:
//   1. External app  -> send header `x-api-key: <REQUEST_API_KEY>`
//   2. Admin dashboard -> sends the logged-in admin's JWT (Authorization Bearer),
//      verified here against the `admins` table.
//
// Deploy: supabase functions deploy request-testimonial --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=... RESEND_FROM=... \
//          REQUEST_API_KEY=... PUBLIC_SITE_URL=...
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'Wall of Fame <onboarding@resend.dev>';
const REQUEST_API_KEY = Deno.env.get('REQUEST_API_KEY') || '';
const PUBLIC_SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || '').replace(/\/$/, '');
const TOKEN_TTL_DAYS = 14;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function isAuthorized(req: Request): Promise<boolean> {
  // Path 1: shared API key for external applications.
  const apiKey = req.headers.get('x-api-key');
  if (REQUEST_API_KEY && apiKey && apiKey === REQUEST_API_KEY) return true;

  // Path 2: a logged-in admin JWT.
  const auth = req.headers.get('Authorization') || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return false;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return false;
  const { data: row } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  return Boolean(row);
}

async function sendEmail(to: string, name: string, link: string) {
  if (!RESEND_API_KEY) {
    // No email provider configured yet: still create the request, but report it
    // so the admin can copy the link manually during setup.
    return { sent: false };
  }
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
      <h2>You're on the Wall of Fame 🏆</h2>
      <p>Hi ${name || 'there'},</p>
      <p>We'd love to add your project story to our Wall of Fame. It takes a couple of
      minutes and you don't need to create any account — just click below:</p>
      <p><a href="${link}" style="background:#b45309;color:#fff;padding:12px 20px;
        border-radius:8px;text-decoration:none;display:inline-block">Add my testimonial</a></p>
      <p style="color:#6b7280;font-size:13px">This link is personal and expires in
      ${TOKEN_TTL_DAYS} days. If the button doesn't work, paste this URL:<br>${link}</p>
    </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject: 'Add your testimonial', html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Email provider error: ${t}`);
  }
  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!(await isAuthorized(req))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const name = String(payload.name || '').trim().slice(0, 120);
  const email = String(payload.email || '').trim().slice(0, 200);
  const project = String(payload.project || '').trim().slice(0, 160);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'A valid email is required.' }, 400);
  }
  if (!PUBLIC_SITE_URL) {
    return json({ error: 'PUBLIC_SITE_URL is not configured on the function.' }, 500);
  }

  try {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000).toISOString();

    const ins = await admin
      .from('testimonial_requests')
      .insert({
        token,
        person_name: name,
        person_email: email,
        project_name: project,
        status: 'sent',
        expires_at: expires,
      })
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    const link = `${PUBLIC_SITE_URL}/submit?token=${token}`;
    const { sent } = await sendEmail(email, name, link);

    return json({
      ok: true,
      sent,
      message: sent
        ? `Invitation emailed to ${email}.`
        : `Request created, but no email provider is configured. Share this link: ${link}`,
      // link is returned only to the authorized caller (admin/external app)
      link,
    });
  } catch (e) {
    console.error('request-testimonial error', e);
    return json({ error: (e as Error).message || 'Server error.' }, 500);
  }
});
