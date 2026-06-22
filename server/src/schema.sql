-- Wall of Fame — plain Postgres schema (no Supabase).
-- Access control is enforced by the API server (JWT admin auth), so there is no
-- RLS here. Idempotent: safe to run on every boot.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- Admins authenticate with email + password (bcrypt hash). Seeded from env by
-- migrate.js (ADMIN_EMAIL / ADMIN_PASSWORD).
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text default '',
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  project_name text default '',
  summary text not null,
  body text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'archived')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists testimonials_status_idx on testimonials (status);
create index if not exists testimonials_person_idx on testimonials (person_id);

create table if not exists filter_options (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  value text not null,
  sort_order int not null default 0,
  unique (category, value)
);

create table if not exists testimonial_tags (
  testimonial_id uuid not null references testimonials (id) on delete cascade,
  filter_option_id uuid not null references filter_options (id) on delete cascade,
  primary key (testimonial_id, filter_option_id)
);

create table if not exists testimonial_requests (
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

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  testimonial_id uuid not null references testimonials (id) on delete cascade,
  author_name text not null,
  body text not null,
  status text not null default 'visible'
    check (status in ('visible', 'hidden', 'pending')),
  created_at timestamptz not null default now()
);
create index if not exists comments_testimonial_idx on comments (testimonial_id);

create table if not exists settings (
  key text primary key,
  value text
);

-- Force comment status on insert so visitors can never self-publish when
-- moderation is enabled (mirrors the old Supabase trigger).
create or replace function set_comment_status()
returns trigger
language plpgsql
as $$
declare
  mod text;
begin
  select value into mod from settings where key = 'comment_moderation';
  if mod = 'on' then
    new.status := 'pending';
  else
    new.status := 'visible';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists trg_comment_status on comments;
create trigger trg_comment_status
  before insert on comments
  for each row execute function set_comment_status();

-- Seed defaults (idempotent).
insert into settings (key, value) values ('comment_moderation', 'off')
on conflict (key) do nothing;

insert into filter_options (category, value, sort_order) values
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
