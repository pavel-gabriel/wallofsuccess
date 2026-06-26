-- Optional sample data for local development / first look at the wall.
-- Safe to skip in production. Run after 0001_init.sql.

do $$
declare
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; p7 uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; t7 uuid; t8 uuid;
  s1 uuid; s2 uuid;
  fo_aws uuid; fo_k8s uuid; fo_tf uuid; fo_react uuid; fo_fin uuid; fo_senior uuid;
begin
  select id into fo_aws from public.filter_options where category='cloud_provider' and value='AWS';
  select id into fo_k8s from public.filter_options where category='technology' and value='Kubernetes';
  select id into fo_tf from public.filter_options where category='technology' and value='Terraform';
  select id into fo_react from public.filter_options where category='technology' and value='React';
  select id into fo_fin from public.filter_options where category='domain' and value='FinTech';
  select id into fo_senior from public.filter_options where category='seniority' and value='Senior';

  insert into public.people (name, title) values ('Ada Lovelace', 'Senior Cloud Engineer')
    returning id into p1;
  insert into public.people (name, title) values ('Grace Hopper', 'Lead Frontend Developer')
    returning id into p2;

  -- Ada's Helios testimonial is pinned, so it leads on her card and modal.
  insert into public.testimonials (person_id, project_name, period_start, period_end, pinned, summary, body, status, approved_at)
  values (p1, 'Project Helios', date '2024-02-01', date '2024-05-01', true,
    'Cut infra costs 40% and led a zero-downtime migration to Kubernetes.',
    e'Ada led the **migration of our monolith to Kubernetes on AWS** with zero downtime.\n\n- Reduced infrastructure spend by ~40%\n- Introduced Terraform for fully reproducible environments\n- Mentored two juniors who are now self-sufficient\n\nA standout engineer we would staff again in a heartbeat.',
    'approved', now())
  returning id into t1;

  insert into public.testimonials (person_id, project_name, period_start, period_end, summary, body, status, approved_at)
  values (p1, 'Project Orion', date '2023-03-01', date '2023-09-01',
    'Designed the multi-region DR strategy that passed every audit.',
    e'On Orion, Ada designed our **multi-region disaster-recovery strategy**. It sailed through every compliance audit and gave the client total confidence.',
    'approved', now())
  returning id into t2;

  insert into public.testimonials (person_id, project_name, period_start, period_end, summary, body, status, approved_at)
  values (p2, 'Customer Portal Revamp', date '2024-04-01', date '2024-10-01',
    'Rebuilt the portal in React; NPS jumped 22 points.',
    e'Grace **rebuilt our customer portal in React** from the ground up. User satisfaction (NPS) jumped 22 points and page loads dropped below one second.',
    'approved', now())
  returning id into t3;

  insert into public.testimonial_tags (testimonial_id, filter_option_id) values
    (t1, fo_aws), (t1, fo_k8s), (t1, fo_tf), (t1, fo_senior),
    (t2, fo_aws), (t2, fo_fin), (t2, fo_senior),
    (t3, fo_react), (t3, fo_fin);

  insert into public.comments (testimonial_id, author_name, body) values
    (t1, 'Project Manager', 'Can confirm — the migration was flawless.');

  -- A second, separate "Ada Lovelace" person row (a different submission)
  -- demonstrates the wall merging duplicate names into one card.
  insert into public.people (name, title) values ('Ada Lovelace', 'Senior Cloud Engineer')
    returning id into p7;
  insert into public.testimonials (person_id, project_name, period_start, period_end, summary, body, status, approved_at)
  values (p7, 'Project Nova', date '2022-01-01', date '2022-08-01',
    'Bootstrapped the platform team and its first golden-path templates.',
    e'Ada stood up our **platform team** on Nova and shipped the first golden-path service templates the whole org now builds on.',
    'approved', now())
  returning id into t8;
  insert into public.testimonial_tags (testimonial_id, filter_option_id) values
    (t8, fo_aws), (t8, fo_senior);

  -- ---------------------------------------------------------------------------
  -- Linked example: a success story whose project_name matches several
  -- approved testimonials, so the story's "Worked on this project" panel is
  -- populated. Two periods exist for Project Helios, so it shows as one card
  -- with "2 implementations" and a period switcher; each version lists only
  -- the testimonials whose period sits inside it.
  -- ---------------------------------------------------------------------------
  insert into public.people (name, title) values ('Linus Park', 'DevOps Engineer') returning id into p3;
  insert into public.people (name, title) values ('Maria Gomez', 'Platform Engineer') returning id into p4;
  insert into public.people (name, title) values ('Tom Becker', 'Site Reliability Engineer') returning id into p5;
  insert into public.people (name, title) values ('Priya Nair', 'Engineering Lead') returning id into p6;

  -- v1 team (periods inside 2024-01 .. 2024-06)
  insert into public.testimonials (person_id, project_name, period_start, period_end, summary, body, status, approved_at)
  values (p3, 'Project Helios', date '2024-01-01', date '2024-06-01',
    'Built the CI/CD pipelines that made daily zero-downtime releases routine.',
    e'Linus built our **GitOps CI/CD pipelines** on Helios. Deployments went from monthly and tense to **daily and boring** — exactly how we like them.',
    'approved', now())
  returning id into t4;

  insert into public.testimonials (person_id, project_name, period_start, period_end, summary, body, status, approved_at)
  values (p5, 'Project Helios', date '2024-03-01', date '2024-06-01',
    'Set up observability that cut mean-time-to-recovery by 60%.',
    e'Tom rolled out **metrics, tracing and alerting** across Helios. MTTR fell ~60% and on-call nights got a lot quieter.',
    'approved', now())
  returning id into t6;

  -- v2 team (periods inside 2025-01 .. 2025-06)
  insert into public.testimonials (person_id, project_name, period_start, period_end, summary, body, status, approved_at)
  values (p4, 'Project Helios', date '2025-02-01', date '2025-05-01',
    'Owned the Terraform modules behind fully reproducible environments.',
    e'Maria designed the **Terraform module library** for the Helios re-platform. Spinning up an identical environment dropped from days to minutes.',
    'approved', now())
  returning id into t5;

  insert into public.testimonials (person_id, project_name, period_start, period_end, summary, body, status, approved_at)
  values (p6, 'Project Helios', date '2025-01-01', date '2025-06-01',
    'Led the team and kept the migration on time and on budget.',
    e'Priya led the second Helios engineering team end to end — **on time, on budget, zero downtime**, and a happy client at the end of it.',
    'approved', now())
  returning id into t7;

  insert into public.testimonial_tags (testimonial_id, filter_option_id) values
    (t4, fo_aws), (t4, fo_k8s),
    (t5, fo_aws), (t5, fo_tf),
    (t6, fo_aws), (t6, fo_k8s),
    (t7, fo_fin), (t7, fo_senior);

  -- Helios v1 (2024 H1)
  insert into public.success_stories
    (title, project_name, period_start, period_end, client_name, client_alias, industry, summary,
     challenge, solution, results, duration, status, is_public, approved_at)
  values (
    'Project Helios — Zero-downtime Kubernetes migration',
    'Project Helios', date '2024-01-01', date '2024-06-01',
    'GlobalBank Plc',
    'Tier-1 EU bank',
    'FinTech',
    'Migrated a core banking monolith to Kubernetes on AWS with zero downtime, cutting infrastructure cost 40%.',
    e'The client''s monolith ran on ageing infrastructure with monthly, high-risk releases and no path to scale for new digital products.',
    e'We migrated the platform to **Kubernetes on AWS**, introduced **Terraform** for reproducible environments, built **GitOps CI/CD** for daily releases, and added full **observability**.',
    e'- **Zero downtime** during the cut-over\n- **~40%** lower infrastructure spend\n- Releases moved from monthly to **daily**\n- **~60%** faster mean-time-to-recovery',
    '6 months',
    'approved', true, now())
  returning id into s1;

  insert into public.story_metrics (story_id, label, value, sort_order) values
    (s1, 'Infra cost', '−40%', 0),
    (s1, 'Downtime', '0', 1),
    (s1, 'Release cadence', 'Daily', 2),
    (s1, 'MTTR', '−60%', 3);

  insert into public.story_contributors (story_id, person_id, name, role, contribution, sort_order) values
    (s1, p1, '', 'Senior Cloud Engineer', 'Led the migration to Kubernetes on AWS.', 0),
    (s1, p3, '', 'DevOps Engineer', 'Built the GitOps CI/CD pipelines.', 1),
    (s1, null, 'External Auditor', 'Compliance', 'Signed off the security review.', 2);

  insert into public.story_tags (story_id, filter_option_id) values
    (s1, fo_aws), (s1, fo_k8s), (s1, fo_tf), (s1, fo_fin);

  -- Helios v2 (2025 H1) — a later implementation for the same project.
  insert into public.success_stories
    (title, project_name, period_start, period_end, client_name, client_alias, industry, summary,
     challenge, solution, results, duration, status, is_public, approved_at)
  values (
    'Project Helios — Multi-region resilience re-platform',
    'Project Helios', date '2025-01-01', date '2025-06-01',
    'GlobalBank Plc',
    'Tier-1 EU bank',
    'FinTech',
    'Extended Helios to active-active multi-region, lifting availability to 99.99% across two AWS regions.',
    e'After the first migration the client needed resilience to a full-region outage and headroom for new digital products.',
    e'We re-platformed to **active-active multi-region** on AWS, hardened the **Terraform** modules, and automated regional failover drills.',
    e'- **99.99%** availability across two regions\n- Automated, tested **region failover**\n- Capacity for 3x traffic growth',
    '6 months',
    'approved', true, now())
  returning id into s2;

  insert into public.story_metrics (story_id, label, value, sort_order) values
    (s2, 'Availability', '99.99%', 0),
    (s2, 'Regions', '2 active', 1),
    (s2, 'Failover', 'Automated', 2);

  insert into public.story_contributors (story_id, person_id, name, role, contribution, sort_order) values
    (s2, p4, '', 'Platform Engineer', 'Owned the Terraform module library.', 0),
    (s2, p6, '', 'Engineering Lead', 'Ran delivery end to end.', 1);

  insert into public.story_tags (story_id, filter_option_id) values
    (s2, fo_aws), (s2, fo_tf), (s2, fo_fin);
end $$;
