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

> **Two ways to run this — same codebase, switched at build time by `PUBLIC_BACKEND`:**
> 1. **Managed (Supabase)** — `PUBLIC_BACKEND=supabase`. Talks directly to
>    Supabase (anon key + RLS), base path `/wallofsuccess`. This is what GitHub
>    Pages builds (set in `.github/workflows/deploy.yml`).
> 2. **Self-hosted on Kubernetes (EKS/AKS)** — `PUBLIC_BACKEND=api` (default). A
>    Node/Express API server replaces Supabase (Auth + Storage + Edge Functions +
>    RLS) and talks to a plain **Postgres**, packaged as a **Helm chart** with an
>    **Ingress**. The `Dockerfile` sets this. See
>    [Kubernetes deployment](#kubernetes-deployment-eksaks).
>
> The two implementations live in `src/lib/backend/{supabase,api}.js`; the rest of
> the app imports a build-time alias `@backend`, so only the selected one is
> bundled (no Supabase client in the k8s image, no `/api` calls on Pages).

---

## Branding (Endava)

The theme follows the Endava brand portal. All values are tokens in
`src/styles/global.css` (`:root`):

- **Colours** — Primary: Red Orange `#FF5640`, Solid Blue `#192B37`, Pure White
  `#FFFFFF`. Neutrals are the Solid Blue opacity shades (`#30404B`…`#E8EAEB`).
  Signal: Positive `#2D9C5B`, Warning `#EB9410`, Negative `#D4403B`. (Data-viz
  palette also available as tokens.)
- **Typography** — Signature font **Dava Sans** (geometric, based on Poppins);
  official fallback **Helvetica**. The font stack is set; drop the licensed
  Dava Sans files in `public/fonts/` and uncomment the `@font-face` block at the
  top of `global.css` to enable it. (Cyrillic/Greek: Noto Sans.)
- **Logo** — `src/components/Brandmark.astro` is a **placeholder** (the logo is a
  trademark, not reproduced here). Replace its SVG with the official asset from
  the **Endava Logo Pack (ZIP)** on the brand portal, keeping the class names.
  Respect the safe zone, the minimum size, and the partner-lockup rules; don't
  recolour or distort it.
- **Images** (visual/images) — photos should be natural and rich in contrast
  (shot in natural light, clear focal point, room for whitespace). Testimonial
  photos get a subtle contrast/saturation treatment and a Solid-Blue neutral
  placeholder via `.avatar` / `img.avatar`.
- **Illustration / gradients** (visual/illustrations) — depth comes from
  **Solid Blue** gradients (`--grad-depth`, used on the brand bar); **Endava
  Orange is only ever an accent**, never the gradient base.
- **Icons** (visual/icons) — geometric, 2px stroke, rounded corners/endings with
  the connecting brand shape. Use SVGs from the official icon library; the
  inline mark in `Brandmark.astro` follows the geometric style.
- **Motion** — one easing/duration token (`--ease`, `--speed`) drives button,
  card, and chip transitions.

---

## Kubernetes deployment (EKS/AKS)

In this mode the same Astro frontend is served by our own API server
(`server/`, Node + Express + `pg`), which provides everything Supabase did:

| Supabase feature | Replacement |
| --- | --- |
| Postgres + RLS | Plain Postgres + **server-enforced** auth (no RLS) |
| Auth (admin login) | JWT issued by `/api/auth/login`, bcrypt password, seeded from env |
| Storage (photos) | Files on a PersistentVolume, served at `/uploads` |
| Edge Functions | `/api/fn/submit-testimonial` and `/api/fn/request-testimonial` |
| Resend email | Optional SMTP (`nodemailer`); unset = "Generate link" still works |

**Architecture in-cluster**

```
        Ingress ──► web Service ──► web Deployment (pod: initContainer "migrate" + "server")
                                          │  serves /  /admin  /submit  /api  /uploads
                                          ▼
                                   Postgres Deployment (+ PVC)
```

The Postgres lives in its own pod with a PVC. The web pod runs **two containers**:
an init container that applies the schema/seeds the admin, then the server
container. (If you specifically want Postgres co-located as a 2-container pod
instead, say so and I'll switch it to a sidecar layout.)

### 1. Build & push the image

```bash
docker build -t ghcr.io/pavel-gabriel/wallofsuccess:latest .
docker push ghcr.io/pavel-gabriel/wallofsuccess:latest
```

### 2. Install with Helm

```bash
helm upgrade --install wof charts/wallofsuccess \
  --set image.repository=ghcr.io/pavel-gabriel/wallofsuccess \
  --set image.tag=latest \
  --set ingress.host=wall.example.com \
  --set app.publicSiteUrl=https://wall.example.com \
  --set app.adminEmail=you@company.com \
  --set app.adminPassword="$(openssl rand -hex 16)" \
  --set app.jwtSecret="$(openssl rand -hex 32)" \
  --set app.requestApiKey="$(openssl rand -hex 24)" \
  --set postgres.password="$(openssl rand -hex 16)"
```

Point DNS for `ingress.host` at your ingress controller, set `app.publicSiteUrl`
to the same host (it builds the `/submit?token=…` links), and you're live. For
TLS, enable `ingress.tls.enabled` with cert-manager annotations.

Optional email: `--set app.smtp.host=…` (plus port/user/password/from). Leave it
empty to disable email — the admin **Generate link** button and the `send:false`
API still return shareable links.

**Notes**
- Default photo storage is a `ReadWriteOnce` PVC, so `web.replicaCount` defaults
  to **1**. Switch to S3/Azure (below) to scale out.
- To use a managed database (RDS/Azure Postgres) instead of the in-cluster pod:
  `--set postgres.enabled=false --set externalDatabaseUrl=postgres://…`.
- All config values live in `charts/wallofsuccess/values.yaml`.

### Photo storage: local PVC, S3, or Azure Blob

Set `storage.driver` to `local` (default), `s3`, or `azure`. With a cloud driver,
disable the uploads PVC and you can run multiple replicas.

**AWS S3** (recommended: IRSA, no static keys):
```bash
helm upgrade --install wof charts/wallofsuccess \
  --set storage.driver=s3 \
  --set storage.s3.bucket=my-wall-photos \
  --set storage.s3.region=eu-central-1 \
  --set web.uploads.enabled=false \
  --set web.replicaCount=2 \
  --set serviceAccount.create=true \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::123456789012:role/wall-photos
```
Photos are served from the bucket; set `storage.s3.publicBaseUrl` to a CloudFront
domain if the bucket isn't directly public. For MinIO / S3-compatible, set
`storage.s3.endpoint` and `storage.s3.forcePathStyle=true`. Static keys (instead
of IRSA) go in `storage.s3.accessKeyId` / `secretAccessKey`.

**Azure Blob**:
```bash
helm upgrade --install wof charts/wallofsuccess \
  --set storage.driver=azure \
  --set storage.azure.connectionString='DefaultEndpointsProtocol=https;AccountName=...' \
  --set storage.azure.container=photos \
  --set web.uploads.enabled=false
```
Or use `storage.azure.account` + `accountKey`. The container must allow public
blob read (or front it with a CDN via `storage.azure.publicBaseUrl`). For AKS
Workload Identity, set `serviceAccount.create=true` with the
`azure.workload.identity/client-id` annotation and
`serviceAccount.podLabels."azure\.workload\.identity/use"=true`.

The driver in use is reported at `GET /healthz` (`"storage":"s3"`).

### External trigger (Kubernetes mode)

Same contract as the managed mode, just against your ingress host:

```bash
curl -X POST "https://wall.example.com/api/fn/request-testimonial" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-REQUEST_API_KEY" \
  -d '{ "name": "Ada Lovelace", "project": "Project Helios", "send": false }'
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

### Generate a link without sending an email

Pass `"send": false` to skip the email and just get back a one-time link to share yourself
(e.g. post it in Slack). `email` is optional in this mode:

```bash
curl -X POST "https://YOUR-ref.supabase.co/functions/v1/request-testimonial" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR-REQUEST_API_KEY" \
  -d '{ "name": "Ada Lovelace", "project": "Project Helios", "send": false }'
```
Response: `{ "ok": true, "sent": false, "message": "Link generated…", "link": "https://…/submit?token=…" }`.
In the admin dashboard this is the **Generate link** button, which shows the link with a copy button.

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
