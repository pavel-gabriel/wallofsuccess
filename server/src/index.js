import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { pool, query, one } from './db.js';
import { signToken, requireAdmin, adminOrApiKey } from './auth.js';
import { sendInvite, mailEnabled } from './mailer.js';
import { savePhotoDataUrl, storageInfo } from './storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const FRONTEND_DIR = process.env.FRONTEND_DIR || resolve(__dirname, '../../dist');
const UPLOADS_DIR = process.env.UPLOADS_DIR || resolve(__dirname, '../../uploads');
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
const TOKEN_TTL_DAYS = Number(process.env.TOKEN_TTL_DAYS || 14);

const app = express();
app.use(express.json({ limit: '6mb' })); // photos arrive as base64 data URLs

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(`${req.method} ${req.path}`, e);
  res.status(500).json({ error: 'Server error.' });
});

// --- shaped testimonial query --------------------------------------------
const TESTIMONIAL_SELECT = `
  select t.id, t.person_id, t.project_name, t.summary, t.body, t.status,
         t.created_at, t.approved_at,
         json_build_object('id', p.id, 'name', p.name, 'title', p.title, 'photo_url', p.photo_url) as person,
         coalesce(
           json_agg(json_build_object('id', fo.id, 'category', fo.category, 'value', fo.value))
             filter (where fo.id is not null), '[]'
         ) as tags
  from testimonials t
  join people p on p.id = t.person_id
  left join testimonial_tags tt on tt.testimonial_id = t.id
  left join filter_options fo on fo.id = tt.filter_option_id
`;
const TESTIMONIAL_GROUP = ' group by t.id, p.id ';

// --- success story query + shaper ----------------------------------------
const STORY_SELECT = `
  select s.*,
    coalesce((select json_agg(json_build_object('id', m.id, 'label', m.label, 'value', m.value, 'sort_order', m.sort_order) order by m.sort_order)
              from story_metrics m where m.story_id = s.id), '[]') as metrics,
    coalesce((select json_agg(json_build_object('id', c.id, 'person_id', c.person_id,
                'name', nullif(coalesce(nullif(c.name, ''), p.name), ''), 'role', c.role,
                'contribution', c.contribution, 'sort_order', c.sort_order) order by c.sort_order)
              from story_contributors c left join people p on p.id = c.person_id where c.story_id = s.id), '[]') as contributors,
    coalesce((select json_agg(json_build_object('id', fo.id, 'category', fo.category, 'value', fo.value))
              from story_tags st join filter_options fo on fo.id = st.filter_option_id where st.story_id = s.id), '[]') as tags
  from success_stories s
`;

// `full` includes the confidential client_name (admin/internal only).
function shapeStory(s, { full }) {
  const out = {
    id: s.id,
    title: s.title,
    clientAlias: s.client_alias,
    industry: s.industry,
    summary: s.summary,
    challenge: s.challenge,
    solution: s.solution,
    results: s.results,
    duration: s.duration,
    status: s.status,
    isPublic: s.is_public,
    createdAt: s.created_at,
    approvedAt: s.approved_at,
    metrics: s.metrics || [],
    contributors: s.contributors || [],
    tags: s.tags || [],
  };
  if (full) out.clientName = s.client_name;
  return out;
}

// Replace-style writers for a story's child collections (run inside a tx).
async function insertStoryMetrics(client, sid, metrics) {
  let i = 0;
  for (const m of metrics || []) {
    const label = String(m.label || '').trim().slice(0, 120);
    const value = String(m.value || '').trim().slice(0, 120);
    if (!label && !value) continue;
    await client.query(
      'insert into story_metrics (story_id, label, value, sort_order) values ($1, $2, $3, $4)',
      [sid, label, value, i++]
    );
  }
}
async function insertStoryContributors(client, sid, contributors) {
  let i = 0;
  for (const c of contributors || []) {
    const name = String(c.name || '').trim().slice(0, 160);
    const role = String(c.role || '').trim().slice(0, 160);
    const contribution = String(c.contribution || '').trim().slice(0, 2000);
    const personId = c.person_id ? String(c.person_id) : null;
    if (!name && !personId && !role && !contribution) continue;
    await client.query(
      'insert into story_contributors (story_id, person_id, name, role, contribution, sort_order) values ($1, $2, $3, $4, $5, $6)',
      [sid, personId, name, role, contribution, i++]
    );
  }
}
async function insertStoryTags(client, sid, tagIds) {
  const ids = (tagIds || []).map(String);
  if (!ids.length) return;
  const valid = (await client.query('select id from filter_options where id = any($1::uuid[])', [ids])).rows;
  for (const r of valid) {
    await client.query(
      'insert into story_tags (story_id, filter_option_id) values ($1, $2) on conflict do nothing',
      [sid, r.id]
    );
  }
}

// --- health ---------------------------------------------------------------
app.get('/healthz', wrap(async (_req, res) => {
  await query('select 1');
  res.json({ ok: true, mail: mailEnabled, storage: storageInfo().driver });
}));

// ======================= PUBLIC API =======================
app.get('/api/testimonials', wrap(async (_req, res) => {
  const { rows } = await query(
    `${TESTIMONIAL_SELECT} where t.status = 'approved' ${TESTIMONIAL_GROUP} order by t.approved_at desc nulls last`
  );
  res.json(rows);
}));

// Public success stories — approved + public only, client_name stripped.
app.get('/api/success-stories', wrap(async (_req, res) => {
  const { rows } = await query(
    `${STORY_SELECT} where s.status = 'approved' and s.is_public order by s.approved_at desc nulls last`
  );
  res.json(rows.map((s) => shapeStory(s, { full: false })));
}));

app.get('/api/success-stories/:id', wrap(async (req, res) => {
  const { rows } = await query(
    `${STORY_SELECT} where s.id = $1 and s.status = 'approved' and s.is_public`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(shapeStory(rows[0], { full: false }));
}));

app.get('/api/filter-options', wrap(async (_req, res) => {
  const { rows } = await query(
    'select id, category, value, sort_order from filter_options order by category asc, sort_order asc'
  );
  res.json(rows);
}));

app.get('/api/settings', wrap(async (_req, res) => {
  const { rows } = await query('select key, value from settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
}));

app.get('/api/testimonials/:id/comments', wrap(async (req, res) => {
  const { rows } = await query(
    `select id, testimonial_id, author_name, body, status, created_at
       from comments where testimonial_id = $1 and status = 'visible'
       order by created_at asc`,
    [req.params.id]
  );
  res.json(rows);
}));

app.post('/api/comments', wrap(async (req, res) => {
  const testimonialId = String(req.body.testimonial_id || '');
  const author = String(req.body.author_name || '').trim().slice(0, 80);
  const body = String(req.body.body || '').trim().slice(0, 2000);
  if (!testimonialId || !author || !body) {
    return res.status(400).json({ error: 'Name and comment are required.' });
  }
  // Trigger sets status (visible/pending) based on the moderation setting.
  const row = await one(
    `insert into comments (testimonial_id, author_name, body)
     values ($1, $2, $3)
     returning id, testimonial_id, author_name, body, status, created_at`,
    [testimonialId, author, body]
  );
  res.json(row);
}));

// ======================= SUBMISSION FLOW (token, no account) =======================
async function findValidRequest(token) {
  const row = await one(`select * from testimonial_requests where token = $1 and status = 'sent'`, [token]);
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row;
}

app.post('/api/fn/submit-testimonial', wrap(async (req, res) => {
  const action = String(req.body.action || '');
  const token = String(req.body.token || '');
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const request = await findValidRequest(token);
  if (!request) return res.status(410).json({ error: 'This link is invalid, used, or expired.' });

  if (action === 'validate') {
    return res.json({ request: { person_name: request.person_name, project_name: request.project_name } });
  }

  if (action === 'submit') {
    const name = String(req.body.name || '').trim().slice(0, 120);
    const title = String(req.body.title || '').trim().slice(0, 160);
    const project = String(req.body.project_name || '').trim().slice(0, 160);
    const summary = String(req.body.summary || '').trim().slice(0, 400);
    const body = String(req.body.body || '').trim().slice(0, 20000);
    const tagIds = Array.isArray(req.body.tag_ids) ? req.body.tag_ids.map(String) : [];
    if (!name || !summary || !body) {
      return res.status(400).json({ error: 'Name, summary, and testimonial body are required.' });
    }

    let photoUrl = null;
    if (typeof req.body.photo === 'string' && req.body.photo.startsWith('data:')) {
      const saved = await savePhotoDataUrl(req.body.photo);
      if (saved.error) return res.status(400).json({ error: saved.error });
      photoUrl = saved.url;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const person = (await client.query(
        'insert into people (name, title, photo_url) values ($1, $2, $3) returning id',
        [name, title, photoUrl]
      )).rows[0];
      const testimonial = (await client.query(
        `insert into testimonials (person_id, project_name, summary, body, status)
         values ($1, $2, $3, $4, 'pending') returning id`,
        [person.id, project, summary, body]
      )).rows[0];
      if (tagIds.length) {
        const valid = (await client.query('select id from filter_options where id = any($1::uuid[])', [tagIds])).rows;
        for (const r of valid) {
          await client.query(
            'insert into testimonial_tags (testimonial_id, filter_option_id) values ($1, $2) on conflict do nothing',
            [testimonial.id, r.id]
          );
        }
      }
      await client.query(`update testimonial_requests set status = 'used' where id = $1`, [request.id]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}));

// request-testimonial: admin JWT OR x-api-key (external apps). Creates a
// one-time link and optionally emails it.
app.post('/api/fn/request-testimonial', adminOrApiKey, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  const email = String(req.body.email || '').trim().slice(0, 200);
  const project = String(req.body.project || '').trim().slice(0, 160);
  const shouldSend = req.body.send !== false;
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (shouldSend && !emailValid) {
    return res.status(400).json({ error: 'A valid email is required to send an invitation.' });
  }
  if (email && !emailValid) {
    return res.status(400).json({ error: 'The email address is not valid.' });
  }
  if (!PUBLIC_SITE_URL) {
    return res.status(500).json({ error: 'PUBLIC_SITE_URL is not configured on the server.' });
  }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000).toISOString();
  await query(
    `insert into testimonial_requests (token, person_name, person_email, project_name, status, expires_at)
     values ($1, $2, $3, $4, 'sent', $5)`,
    [token, name, email || null, project, expires]
  );

  const link = `${PUBLIC_SITE_URL}/submit?token=${token}`;
  let sent = false;
  if (shouldSend) {
    try {
      ({ sent } = await sendInvite(email, name, link));
    } catch (e) {
      return res.status(502).json({ error: `Email provider error: ${e.message}` });
    }
  }
  res.json({
    ok: true,
    sent,
    link,
    message: sent
      ? `Invitation emailed to ${email}.`
      : shouldSend
        ? `Request created, but email is not configured. Share this link: ${link}`
        : `Link generated${name ? ` for ${name}` : ''}. Copy it and share: ${link}`,
  });
}));

// submit-story: public token flow (no account), mirrors submit-testimonial.
app.post('/api/fn/submit-story', wrap(async (req, res) => {
  const action = String(req.body.action || '');
  const token = String(req.body.token || '');
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const request = await one(`select * from story_requests where token = $1 and status = 'sent'`, [token]);
  const valid = request && (!request.expires_at || new Date(request.expires_at) >= new Date());
  if (!valid) return res.status(410).json({ error: 'This link is invalid, used, or expired.' });

  if (action === 'validate') {
    return res.json({ request: { client_name: request.client_name, project_name: request.project_name } });
  }

  if (action === 'submit') {
    const f = req.body;
    const title = String(f.title || '').trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: 'A project title is required.' });
    const vals = [
      title,
      String(f.client_name || '').trim().slice(0, 200),
      String(f.client_alias || '').trim().slice(0, 200),
      String(f.industry || '').trim().slice(0, 120),
      String(f.summary || '').trim().slice(0, 600),
      String(f.challenge || '').trim().slice(0, 8000),
      String(f.solution || '').trim().slice(0, 8000),
      String(f.results || '').trim().slice(0, 8000),
      String(f.duration || '').trim().slice(0, 120),
    ];
    const client = await pool.connect();
    try {
      await client.query('begin');
      const sid = (await client.query(
        `insert into success_stories
           (title, client_name, client_alias, industry, summary, challenge, solution, results, duration, status, is_public)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',false) returning id`,
        vals
      )).rows[0].id;
      await insertStoryMetrics(client, sid, f.metrics);
      await insertStoryContributors(client, sid, f.contributors);
      await insertStoryTags(client, sid, f.tag_ids);
      await client.query(`update story_requests set status = 'used' where id = $1`, [request.id]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}));

// request-story: admin JWT OR x-api-key; creates a one-time link and optionally emails it.
app.post('/api/fn/request-story', adminOrApiKey, wrap(async (req, res) => {
  const clientName = String(req.body.client_name || '').trim().slice(0, 200);
  const project = String(req.body.project || '').trim().slice(0, 200);
  const email = String(req.body.email || '').trim().slice(0, 200);
  const shouldSend = req.body.send !== false;
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (shouldSend && !emailValid) {
    return res.status(400).json({ error: 'A valid email is required to send an invitation.' });
  }
  if (email && !emailValid) {
    return res.status(400).json({ error: 'The email address is not valid.' });
  }
  if (!PUBLIC_SITE_URL) {
    return res.status(500).json({ error: 'PUBLIC_SITE_URL is not configured on the server.' });
  }
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000).toISOString();
  await query(
    `insert into story_requests (token, client_name, project_name, status, expires_at)
     values ($1, $2, $3, 'sent', $4)`,
    [token, clientName || null, project, expires]
  );
  const link = `${PUBLIC_SITE_URL}/story-submit?token=${token}`;
  let sent = false;
  if (shouldSend) {
    try {
      ({ sent } = await sendInvite(email, clientName, link));
    } catch (e) {
      return res.status(502).json({ error: `Email provider error: ${e.message}` });
    }
  }
  res.json({
    ok: true,
    sent,
    link,
    message: sent
      ? `Invitation emailed to ${email}.`
      : shouldSend
        ? `Request created, but email is not configured. Share this link: ${link}`
        : `Link generated. Copy it and share: ${link}`,
  });
}));

// ======================= AUTH =======================
app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const admin = await one('select id, email, password_hash from admins where email = $1', [email]);
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json({ token: signToken(admin), user: { email: admin.email } });
}));

app.get('/api/auth/me', requireAdmin, (req, res) => {
  res.json({ user: { email: req.admin.email } });
});

// ======================= ADMIN API (JWT) =======================
const admin = express.Router();
admin.use(requireAdmin);

admin.get('/testimonials', wrap(async (_req, res) => {
  const { rows } = await query(`${TESTIMONIAL_SELECT} ${TESTIMONIAL_GROUP} order by t.created_at desc`);
  res.json(rows);
}));

admin.patch('/testimonials/:id', wrap(async (req, res) => {
  const allowed = ['status', 'summary', 'body', 'project_name'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in req.body) {
      vals.push(req.body[k]);
      sets.push(`${k} = $${vals.length}`);
    }
  }
  if (req.body.status === 'approved') {
    vals.push(new Date().toISOString());
    sets.push(`approved_at = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
  vals.push(req.params.id);
  await query(`update testimonials set ${sets.join(', ')} where id = $${vals.length}`, vals);
  res.json({ ok: true });
}));

admin.delete('/testimonials/:id', wrap(async (req, res) => {
  await query('delete from testimonials where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

admin.put('/testimonials/:id/tags', wrap(async (req, res) => {
  const tagIds = Array.isArray(req.body.tag_ids) ? req.body.tag_ids.map(String) : [];
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from testimonial_tags where testimonial_id = $1', [req.params.id]);
    for (const fid of tagIds) {
      await client.query(
        'insert into testimonial_tags (testimonial_id, filter_option_id) values ($1, $2) on conflict do nothing',
        [req.params.id, fid]
      );
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true });
}));

admin.patch('/people/:id', wrap(async (req, res) => {
  const allowed = ['name', 'title', 'photo_url'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in req.body) {
      vals.push(req.body[k]);
      sets.push(`${k} = $${vals.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
  vals.push(req.params.id);
  await query(`update people set ${sets.join(', ')} where id = $${vals.length}`, vals);
  res.json({ ok: true });
}));

admin.get('/comments', wrap(async (_req, res) => {
  const { rows } = await query(
    `select id, testimonial_id, author_name, body, status, created_at
       from comments order by created_at desc`
  );
  res.json(rows);
}));

admin.patch('/comments/:id', wrap(async (req, res) => {
  await query('update comments set status = $1 where id = $2', [String(req.body.status), req.params.id]);
  res.json({ ok: true });
}));

admin.delete('/comments/:id', wrap(async (req, res) => {
  await query('delete from comments where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

admin.post('/filter-options', wrap(async (req, res) => {
  const category = String(req.body.category || '').trim();
  const value = String(req.body.value || '').trim();
  const sortOrder = Number(req.body.sort_order || 0);
  if (!category || !value) return res.status(400).json({ error: 'Category and value are required.' });
  await query(
    `insert into filter_options (category, value, sort_order) values ($1, $2, $3)
     on conflict (category, value) do nothing`,
    [category, value, sortOrder]
  );
  res.json({ ok: true });
}));

admin.delete('/filter-options/:id', wrap(async (req, res) => {
  await query('delete from filter_options where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

admin.put('/settings/:key', wrap(async (req, res) => {
  await query(
    `insert into settings (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value`,
    [req.params.key, String(req.body.value ?? '')]
  );
  res.json({ ok: true });
}));

// --- admin: success stories ---
admin.get('/success-stories', wrap(async (_req, res) => {
  const { rows } = await query(`${STORY_SELECT} order by s.created_at desc`);
  res.json(rows.map((s) => shapeStory(s, { full: true })));
}));

admin.get('/success-stories/:id', wrap(async (req, res) => {
  const { rows } = await query(`${STORY_SELECT} where s.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(shapeStory(rows[0], { full: true }));
}));

admin.post('/success-stories', wrap(async (req, res) => {
  const f = req.body;
  if (!String(f.title || '').trim()) return res.status(400).json({ error: 'Title is required.' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const sid = (await client.query(
      `insert into success_stories
         (title, client_name, client_alias, industry, summary, challenge, solution, results, duration, status, is_public)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [
        String(f.title).trim().slice(0, 200),
        String(f.client_name || '').trim().slice(0, 200),
        String(f.client_alias || '').trim().slice(0, 200),
        String(f.industry || '').trim().slice(0, 120),
        String(f.summary || '').trim().slice(0, 600),
        String(f.challenge || '').slice(0, 8000),
        String(f.solution || '').slice(0, 8000),
        String(f.results || '').slice(0, 8000),
        String(f.duration || '').trim().slice(0, 120),
        ['pending', 'approved', 'archived'].includes(f.status) ? f.status : 'pending',
        Boolean(f.is_public),
      ]
    )).rows[0].id;
    await insertStoryMetrics(client, sid, f.metrics);
    await insertStoryContributors(client, sid, f.contributors);
    await insertStoryTags(client, sid, f.tag_ids);
    await client.query('commit');
    res.json({ ok: true, id: sid });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

admin.patch('/success-stories/:id', wrap(async (req, res) => {
  const allowed = ['title', 'client_name', 'client_alias', 'industry', 'summary',
    'challenge', 'solution', 'results', 'duration', 'status', 'is_public'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in req.body) {
      vals.push(req.body[k]);
      sets.push(`${k} = $${vals.length}`);
    }
  }
  if (req.body.status === 'approved') {
    vals.push(new Date().toISOString());
    sets.push(`approved_at = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
  vals.push(req.params.id);
  await query(`update success_stories set ${sets.join(', ')} where id = $${vals.length}`, vals);
  res.json({ ok: true });
}));

admin.delete('/success-stories/:id', wrap(async (req, res) => {
  await query('delete from success_stories where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Replace a story's metrics / contributors / tags in one call.
admin.put('/success-stories/:id/children', wrap(async (req, res) => {
  const sid = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('begin');
    if ('metrics' in req.body) {
      await client.query('delete from story_metrics where story_id = $1', [sid]);
      await insertStoryMetrics(client, sid, req.body.metrics);
    }
    if ('contributors' in req.body) {
      await client.query('delete from story_contributors where story_id = $1', [sid]);
      await insertStoryContributors(client, sid, req.body.contributors);
    }
    if ('tag_ids' in req.body) {
      await client.query('delete from story_tags where story_id = $1', [sid]);
      await insertStoryTags(client, sid, req.body.tag_ids);
    }
    await client.query('commit');
    res.json({ ok: true });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

app.use('/api/admin', admin);

// ======================= STATIC (uploads + built frontend) =======================
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(express.static(FRONTEND_DIR, { maxAge: '1h', extensions: ['html'] }));

// SPA-ish fallback for Astro's directory pages (e.g. /submit -> /submit/index.html).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(join(FRONTEND_DIR, '404.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(PORT, () => console.log(`Wall of Fame server listening on :${PORT}`));
