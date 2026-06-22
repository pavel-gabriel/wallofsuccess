// Public Edge Function: validates a one-time token and accepts a success story.
// No account required. Runs with the service role so the client can never set
// status/is_public or read other requests. Mirror of submit-testimonial.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function findValidRequest(token: string) {
  const { data, error } = await admin
    .from('story_requests')
    .select('*')
    .eq('token', token)
    .eq('status', 'sent')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
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

    if (action === 'validate') {
      return json({ request: { client_name: request.client_name, project_name: request.project_name } });
    }

    if (action === 'submit') {
      const title = String(payload.title || '').trim().slice(0, 200);
      if (!title) return json({ error: 'A project title is required.' }, 400);

      const base = {
        title,
        client_name: String(payload.client_name || '').trim().slice(0, 200),
        client_alias: String(payload.client_alias || '').trim().slice(0, 200),
        industry: String(payload.industry || '').trim().slice(0, 120),
        summary: String(payload.summary || '').trim().slice(0, 600),
        challenge: String(payload.challenge || '').slice(0, 8000),
        solution: String(payload.solution || '').slice(0, 8000),
        results: String(payload.results || '').slice(0, 8000),
        duration: String(payload.duration || '').trim().slice(0, 120),
        status: 'pending',
        is_public: false,
      };
      const ins = await admin.from('success_stories').insert(base).select('id').single();
      if (ins.error) throw ins.error;
      const sid = ins.data.id;

      const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];
      const mrows = metrics
        .filter((m: any) => m.label || m.value)
        .map((m: any, i: number) => ({
          story_id: sid,
          label: String(m.label || '').slice(0, 120),
          value: String(m.value || '').slice(0, 120),
          sort_order: i,
        }));
      if (mrows.length) await admin.from('story_metrics').insert(mrows);

      const contributors = Array.isArray(payload.contributors) ? payload.contributors : [];
      const crows = contributors
        .filter((c: any) => c.name || c.role)
        .map((c: any, i: number) => ({
          story_id: sid,
          name: String(c.name || '').slice(0, 160),
          role: String(c.role || '').slice(0, 160),
          contribution: String(c.contribution || '').slice(0, 2000),
          sort_order: i,
        }));
      if (crows.length) await admin.from('story_contributors').insert(crows);

      const tagIds = Array.isArray(payload.tag_ids) ? payload.tag_ids.map(String) : [];
      if (tagIds.length) {
        const valid = await admin.from('filter_options').select('id').in('id', tagIds);
        const ids = (valid.data || []).map((r) => r.id);
        if (ids.length) await admin.from('story_tags').insert(ids.map((fid) => ({ story_id: sid, filter_option_id: fid })));
      }

      await admin.from('story_requests').update({ status: 'used' }).eq('id', request.id);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('submit-story error', e);
    return json({ error: 'Server error. Please try again.' }, 500);
  }
});
