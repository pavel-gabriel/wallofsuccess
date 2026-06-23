-- Wall of Fame — database schema, Row Level Security, and seed data.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Admins: which auth users may manage content.
-- Add a row here (with the user's id from auth.users) to grant admin access.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Core content tables
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text default '',
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  project_name text default '',
  summary text not null,
  body text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'archived')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists testimonials_status_idx on public.testimonials (status);
create index if not exists testimonials_person_idx on public.testimonials (person_id);

create table if not exists public.filter_options (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  value text not null,
  sort_order int not null default 0,
  unique (category, value)
);

create table if not exists public.testimonial_tags (
  testimonial_id uuid not null references public.testimonials (id) on delete cascade,
  filter_option_id uuid not null references public.filter_options (id) on delete cascade,
  primary key (testimonial_id, filter_option_id)
);

create table if not exists public.testimonial_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  person_name text,
  person_email text,
  project_name text,
  status text not null default 'sent'
    check (status in ('sent', 'used', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  testimonial_id uuid not null references public.testimonials (id) on delete cascade,
  author_name text not null,
  body text not null,
  status text not null default 'visible'
    check (status in ('visible', 'hidden', 'pending')),
  created_at timestamptz not null default now()
);
create index if not exists comments_testimonial_idx on public.comments (testimonial_id);

create table if not exists public.settings (
  key text primary key,
  value text
);

-- ---------------------------------------------------------------------------
-- Comment moderation: force status on insert so visitors can never self-publish
-- when moderation is enabled.
-- ---------------------------------------------------------------------------
create or replace function public.set_comment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mod text;
begin
  select value into mod from public.settings where key = 'comment_moderation';
  if mod = 'on' then
    new.status := 'pending';
  else
    new.status := 'visible';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists trg_comment_status on public.comments;
create trigger trg_comment_status
  before insert on public.comments
  for each row execute function public.set_comment_status();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.people enable row level security;
alter table public.testimonials enable row level security;
alter table public.filter_options enable row level security;
alter table public.testimonial_tags enable row level security;
alter table public.testimonial_requests enable row level security;
alter table public.comments enable row level security;
alter table public.settings enable row level security;
alter table public.admins enable row level security;

-- people: public can read (names/titles/photos are meant to be shown).
drop policy if exists people_read on public.people;
create policy people_read on public.people for select using (true);
drop policy if exists people_admin on public.people;
create policy people_admin on public.people for all
  using (public.is_admin()) with check (public.is_admin());

-- testimonials: public reads only approved; admins do everything.
drop policy if exists testimonials_read on public.testimonials;
create policy testimonials_read on public.testimonials for select
  using (status = 'approved' or public.is_admin());
drop policy if exists testimonials_admin on public.testimonials;
create policy testimonials_admin on public.testimonials for all
  using (public.is_admin()) with check (public.is_admin());

-- filter_options: public read; admin manage.
drop policy if exists filter_read on public.filter_options;
create policy filter_read on public.filter_options for select using (true);
drop policy if exists filter_admin on public.filter_options;
create policy filter_admin on public.filter_options for all
  using (public.is_admin()) with check (public.is_admin());

-- testimonial_tags: public read; admin manage.
drop policy if exists tags_read on public.testimonial_tags;
create policy tags_read on public.testimonial_tags for select using (true);
drop policy if exists tags_admin on public.testimonial_tags;
create policy tags_admin on public.testimonial_tags for all
  using (public.is_admin()) with check (public.is_admin());

-- testimonial_requests: admin only (Edge Functions use the service role).
drop policy if exists requests_admin on public.testimonial_requests;
create policy requests_admin on public.testimonial_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- comments: public reads visible; public may insert (status forced by trigger);
-- admins manage all.
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select
  using (status = 'visible' or public.is_admin());
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (char_length(author_name) between 1 and 80 and char_length(body) between 1 and 2000);
drop policy if exists comments_admin on public.comments;
create policy comments_admin on public.comments for all
  using (public.is_admin()) with check (public.is_admin());

-- settings: public read; admin write.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- admins: a user may see their own admin row (so is_admin checks work); only
-- existing admins may see the whole table. No public writes.
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket for profile photos (public read; writes via service role only).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists photos_public_read on storage.objects;
create policy photos_public_read on storage.objects for select
  using (bucket_id = 'photos');

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('comment_moderation', 'off')
on conflict (key) do nothing;

insert into public.filter_options (category, value, sort_order) values
  ('cloud_provider', 'AWS', 1),
  ('cloud_provider', 'Azure', 2),
  ('cloud_provider', 'Google Cloud', 3),
  ('technology', 'Kubernetes', 1),
  ('technology', 'Terraform', 2),
  ('technology', 'React', 3),
  ('technology', 'Node.js', 4),
  ('technology', 'Python', 5),
  ('technology', 'Go', 6),
  ('domain', 'FinTech', 1),
  ('domain', 'Healthcare', 2),
  ('domain', 'E-commerce', 3),
  ('seniority', 'Junior', 1),
  ('seniority', 'Mid', 2),
  ('seniority', 'Senior', 3),
  ('seniority', 'Lead', 4)
on conflict (category, value) do nothing;

-- ---------------------------------------------------------------------------
-- Success Stories (project/client case studies for bids)
-- ---------------------------------------------------------------------------
create table if not exists public.success_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_name text default '',       -- link key to testimonials.project_name
  client_name text default '',        -- full name, internal only (never exposed to anon)
  client_alias text default '',       -- public-safe label
  industry text default '',
  summary text default '',
  challenge text default '',
  solution text default '',
  results text default '',
  duration text default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'archived')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists stories_status_idx on public.success_stories (status);
alter table public.success_stories add column if not exists project_name text default '';

create table if not exists public.story_metrics (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.success_stories (id) on delete cascade,
  label text not null,
  value text not null,
  sort_order int not null default 0
);

create table if not exists public.story_contributors (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.success_stories (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  name text default '',
  role text default '',
  contribution text default '',
  sort_order int not null default 0
);

create table if not exists public.story_tags (
  story_id uuid not null references public.success_stories (id) on delete cascade,
  filter_option_id uuid not null references public.filter_options (id) on delete cascade,
  primary key (story_id, filter_option_id)
);

create table if not exists public.story_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  client_name text,
  project_name text,
  status text not null default 'sent'
    check (status in ('sent', 'used', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS: base tables are admin-only. The anonymized public view (below) is the
-- only thing anon can read, so client_name never leaves the server for anon.
alter table public.success_stories enable row level security;
alter table public.story_metrics enable row level security;
alter table public.story_contributors enable row level security;
alter table public.story_tags enable row level security;
alter table public.story_requests enable row level security;

drop policy if exists stories_admin on public.success_stories;
create policy stories_admin on public.success_stories for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists story_metrics_admin on public.story_metrics;
create policy story_metrics_admin on public.story_metrics for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists story_contributors_admin on public.story_contributors;
create policy story_contributors_admin on public.story_contributors for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists story_tags_admin on public.story_tags;
create policy story_tags_admin on public.story_tags for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists story_requests_admin on public.story_requests;
create policy story_requests_admin on public.story_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- Anonymized public view: approved + is_public only, no client_name, with
-- metrics/contributors/tags pre-joined as JSON. Runs with the view owner's
-- rights so it bypasses the base-table RLS; anon is granted the view only.
create or replace view public.public_success_stories as
select
  s.id, s.title, s.project_name, s.client_alias, s.industry, s.summary,
  s.challenge, s.solution, s.results, s.duration, s.created_at, s.approved_at,
  coalesce((select json_agg(json_build_object('label', m.label, 'value', m.value) order by m.sort_order)
            from public.story_metrics m where m.story_id = s.id), '[]') as metrics,
  coalesce((select json_agg(json_build_object('name', nullif(coalesce(p.name, c.name), ''),
                                              'role', c.role, 'contribution', c.contribution) order by c.sort_order)
            from public.story_contributors c left join public.people p on p.id = c.person_id
            where c.story_id = s.id), '[]') as contributors,
  coalesce((select json_agg(json_build_object('id', fo.id, 'category', fo.category, 'value', fo.value))
            from public.story_tags st join public.filter_options fo on fo.id = st.filter_option_id
            where st.story_id = s.id), '[]') as tags
from public.success_stories s
where s.status = 'approved' and s.is_public;

grant select on public.public_success_stories to anon, authenticated;
