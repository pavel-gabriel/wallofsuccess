// Public Edge Function: validates a one-time token and accepts a testimonial.
// No teammate account required. Runs with the service role so the client can
// never set status, write people directly, or read other people's requests.
//
// Deploy: supabase functions deploy submit-testimonial --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function findValidRequest(token: string) {
  const { data, error } = await admin
    .from('testimonial_requests')
    .select('*')
    .eq('token', token)
    .eq('status', 'sent')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, ext };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const action = String(payload.action || '');
  const token = String(payload.token || '');
  if (!token) return json({ error: 'Missing token' }, 400);

  try {
    const request = await findValidRequest(token);
    if (!request) return json({ error: 'This link is invalid, used, or expired.' }, 410);

    // --- validate: return safe prefill info only ---
    if (action === 'validate') {
      return json({
        request: {
          person_name: request.person_name,
          project_name: request.project_name,
        },
      });
    }

    // --- submit: create the pending testimonial ---
    if (action === 'submit') {
      const name = String(payload.name || '').trim().slice(0, 120);
      const title = String(payload.title || '').trim().slice(0, 160);
      const project = String(payload.project_name || '').trim().slice(0, 160);
      const periodStart = payload.period_start || null;
      const periodEnd = payload.period_end || null;
      const summary = String(payload.summary || '').trim().slice(0, 400);
      const body = String(payload.body || '').trim().slice(0, 20000);
      const tagIds = Array.isArray(payload.tag_ids) ? payload.tag_ids.map(String) : [];

      if (!name || !summary || !body) {
        return json({ error: 'Name, summary, and testimonial body are required.' }, 400);
      }

      // Optional photo upload
      let photoUrl: string | null = null;
      if (typeof payload.photo === 'string' && payload.photo.startsWith('data:')) {
        const decoded = decodeDataUrl(payload.photo);
        if (!decoded) return json({ error: 'Unsupported image format.' }, 400);
        if (decoded.bytes.length > MAX_PHOTO_BYTES) {
          return json({ error: 'Photo must be 2 MB or smaller.' }, 400);
        }
        const path = `${crypto.randomUUID()}.${decoded.ext}`;
        const up = await admin.storage
          .from('photos')
          .upload(path, decoded.bytes, { contentType: `image/${decoded.ext}`, upsert: false });
        if (up.error) return json({ error: 'Photo upload failed.' }, 500);
        photoUrl = admin.storage.from('photos').getPublicUrl(path).data.publicUrl;
      }

      // Person
      const personRes = await admin
        .from('people')
        .insert({ name, title, photo_url: photoUrl })
        .select('id')
        .single();
      if (personRes.error) throw personRes.error;
      const personId = personRes.data.id;

      // Testimonial (always pending)
      const tRes = await admin
        .from('testimonials')
        .insert({
          person_id: personId,
          project_name: project,
          period_start: periodStart,
          period_end: periodEnd,
          summary,
          body,
          status: 'pending',
        })
        .select('id')
        .single();
      if (tRes.error) throw tRes.error;
      const testimonialId = tRes.data.id;

      // Tags (only accept ids that actually exist)
      if (tagIds.length) {
        const valid = await admin.from('filter_options').select('id').in('id', tagIds);
        const validIds = (valid.data || []).map((r) => r.id);
        if (validIds.length) {
          await admin
            .from('testimonial_tags')
            .insert(validIds.map((fid) => ({ testimonial_id: testimonialId, filter_option_id: fid })));
        }
      }

      // Burn the token
      await admin.from('testimonial_requests').update({ status: 'used' }).eq('id', request.id);

      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('submit-testimonial error', e);
    return json({ error: (e instanceof Error && e.message) || 'Server error. Please try again.' }, 500);
  }
});
