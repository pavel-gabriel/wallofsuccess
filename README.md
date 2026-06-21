# Wall of Fame 🏆

A public **Wall of Fame** for an IT outsourcing company: team members are shown as
**sticky notes** with short blurbs that **enlarge on click** to reveal the full story.
The wall is **filterable** (cloud provider, technology, domain, seniority…) so prospective
clients can quickly shortlist people for a future team.

- **Frontend:** [Astro](https://astro.build) static site + Preact islands → hosted free on **GitHub Pages**.
- **Backend:** [Supabase](https://supabase.com) free tier — Postgres, Auth, Storage, Edge Functions.
- **Email:** [Resend](https://resend.com) (or any API-compatible provider).
- **Teammates never create an account** — they receive a one-time tokenized link by email and fill a form.
- **Admins log in** to a dashboard to approve/edit/delete testimonials, moderate comments, manage filters, and send invites.

```
Astro (GitHub Pages) ──anon key + RLS──► Supabase (Postgres / Auth / Storage / Edge Functions) ──► Resend
```

---

## How it works

| Flow | Path |
| --- | --- |
| **Public wall** | `/` fetches approved testimonials at runtime (no rebuild needed when content changes). |
| **Submit (no account)** | Admin/external app triggers an email → recipient opens `/submit?token=…` → form → stored as `pending`. |
| **Admin** | `/admin` → email/password login → review queue, CRUD, comment moderation, filter config, invites. |
| **External trigger** | Any app `POST`s to the `request-testimonial` Edge Function with an API key. |

Security is enforced by Postgres **Row Level Security** (see `supabase/migrations/0001_init.sql`).
The anon key in the static bundle is public by design; the **service-role key and Resend key live
only in Supabase function secrets**.

---

## Setup

### 1. Create the Supabase project
1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **SQL Editor** → run `supabase/migrations/0001_init.sql` (schema + RLS + a `photos` storage bucket + seed filter options).
3. *(optional, for a local demo)* run `supabase/seed.sql` to add sample testimonials.

### 2. Create the first admin
1. **Authentication → Users → Add user** (email + password). Disable "email confirm" or confirm the user.
2. Copy the user's UUID, then in the **SQL Editor**:
   ```sql
   insert into public.admins (user_id) values ('PASTE-USER-UUID');
   ```

### 3. Configure the frontend
Copy `.env.example` → `.env` and fill in (from **Project Settings → API**):
```
PUBLIC_SUPABASE_URL="https://YOUR-ref.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="YOUR-anon-key"
```
Then:
```bash
npm install
npm run dev      # http://localhost:4321/wallofsuccess
```

### 4. Deploy the Edge Functions
Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:
```bash
supabase link --project-ref YOUR-ref

# secrets (never committed, never in the frontend)
supabase secrets set \
  RESEND_API_KEY="re_..." \
  RESEND_FROM="Wall of Fame <noreply@yourdomain.com>" \
  REQUEST_API_KEY="$(openssl rand -hex 24)" \
  PUBLIC_SITE_URL="https://pavel-gabriel.github.io/wallofsuccess"

supabase functions deploy submit-testimonial  --no-verify-jwt
supabase functions deploy request-testimonial --no-verify-jwt
```
> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into functions — you don't set them.
> Without `RESEND_API_KEY` the invite still works: the function returns the link for you to share manually.

### 5. Deploy the site to GitHub Pages
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables** → add
   `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
3. Merge to `main` → the `.github/workflows/deploy.yml` workflow builds and publishes.
4. Site lives at `https://pavel-gabriel.github.io/wallofsuccess`.
   - Using a **custom domain**? Set `SITE_URL` and `BASE_PATH=/` (in `astro.config.mjs` or as build env) and update `PUBLIC_SITE_URL`.

---

## Triggering a testimonial request from another application

`POST https://YOUR-ref.supabase.co/functions/v1/request-testimonial`

```bash
curl -X POST "https://YOUR-ref.supabase.co/functions/v1/request-testimonial" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-REQUEST_API_KEY" \
  -d '{ "name": "Ada Lovelace", "email": "ada@example.com", "project": "Project Helios" }'
```
Response: `{ "ok": true, "sent": true, "message": "...", "link": "https://…/submit?token=…" }`.
The recipient gets an email with the link and submits without any account. The admin dashboard's
**Request testimonial** tab calls the same endpoint (authenticated by the admin's login instead of the API key).

---

## Project structure

```
src/
  pages/        index.astro (wall) · submit.astro · admin.astro
  components/   Wall, StickyNote, FilterBar, TestimonialModal, Comments, SubmitForm, admin/*
  lib/          supabase.js · data.js · adminData.js · functions.js · util.js
  styles/       global.css (sticky-note board, modal, forms)
supabase/
  migrations/0001_init.sql   schema + RLS + storage + seed filters
  seed.sql                   optional sample testimonials
  functions/                 request-testimonial · submit-testimonial · _shared/cors.ts
  config.toml
.github/workflows/deploy.yml  build + GitHub Pages deploy
```

## Verifying end-to-end
1. **Wall**: with seed data, `/` shows sticky notes; filters narrow results; clicking opens the modal (Ada has 2 testimonials → tabs) with comments.
2. **Invite**: call `request-testimonial` → a `testimonial_requests` row appears + email arrives.
3. **Submit**: open the link → fill the form → a `pending` testimonial appears.
4. **Admin**: log in at `/admin` → approve it → it shows on the wall immediately (no rebuild); edit/delete, moderate comments, add a filter option, toggle comment moderation.
5. **RLS check**: with only the anon key you cannot read `pending` rows or mutate data.
