import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { pool, query, one } from './db.js';
import { signToken, requireAdmin, adminOrApiKey } from './auth.js';
import { sendInvite, mailEnabled } from './mailer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const FRONTEND_DIR = process.env.FRONTEND_DIR || resolve(__dirname, '../../dist');
const UPLOADS_DIR = process.env.UPLOADS_DIR || resolve(__dirname, '../../uploads');
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
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

// --- health ---------------------------------------------------------------
app.get('/healthz', wrap(async (_req, res) => {
  await query('select 1');
  res.json({ ok: true, mail: mailEnabled });
}));

// ======================= PUBLIC API =======================
app.get('/api/testimonials', wrap(async (_req, res) => {
  const { rows } = await query(
    `${TESTIMONIAL_SELECT} where t.status = 'approved' ${TESTIMONIAL_GROUP} order by t.approved_at desc nulls last`
  );
  res.json(rows);
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

async function saveDataUrlPhoto(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return { error: 'Unsupported image format.' };
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'Photo must be 2 MB or smaller.' };
  await mkdir(UPLOADS_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await writeFile(join(UPLOADS_DIR, name), bytes);
  return { url: `/uploads/${name}` };
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
      const saved = await saveDataUrlPhoto(req.body.photo);
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
