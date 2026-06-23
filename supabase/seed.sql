-- Optional sample data for local development / first look at the wall.
-- Safe to skip in production. Run after 0001_init.sql.

do $$
declare
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; t7 uuid;
  s1 uuid;
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

  insert into public.testimonials (person_id, project_name, summary, body, status, approved_at)
  values (p1, 'Project Helios',
    'Cut infra costs 40% and led a zero-downtime migration to Kubernetes.',
    e'Ada led the **migration of our monolith to Kubernetes on AWS** with zero downtime.\n\n- Reduced infrastructure spend by ~40%\n- Introduced Terraform for fully reproducible environments\n- Mentored two juniors who are now self-sufficient\n\nA standout engineer we would staff again in a heartbeat.',
    'approved', now())
  returning id into t1;

  insert into public.testimonials (person_id, project_name, summary, body, status, approved_at)
  values (p1, 'Project Orion',
    'Designed the multi-region DR strategy that passed every audit.',
    e'On Orion, Ada designed our **multi-region disaster-recovery strategy**. It sailed through every compliance audit and gave the client total confidence.',
    'approved', now())
  returning id into t2;

  insert into public.testimonials (person_id, project_name, summary, body, status, approved_at)
  values (p2, 'Customer Portal Revamp',
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

  -- ---------------------------------------------------------------------------
  -- Linked example: a success story whose project_name matches several
  -- approved testimonials, so the story's "Worked on this project" panel is
  -- populated (and paginates at 4 per page).
  -- ---------------------------------------------------------------------------
  insert into public.people (name, title) values ('Linus Park', 'DevOps Engineer') returning id into p3;
  insert into public.people (name, title) values ('Maria Gomez', 'Platform Engineer') returning id into p4;
  insert into public.people (name, title) values ('Tom Becker', 'Site Reliability Engineer') returning id into p5;
  insert into public.people (name, title) values ('Priya Nair', 'Engineering Lead') returning id into p6;

  insert into public.testimonials (person_id, project_name, summary, body, status, approved_at)
  values (p3, 'Project Helios',
    'Built the CI/CD pipelines that made daily zero-downtime releases routine.',
    e'Linus built our **GitOps CI/CD pipelines** on Helios. Deployments went from monthly and tense to **daily and boring** — exactly how we like them.',
    'approved', now())
  returning id into t4;

  insert into public.testimonials (person_id, project_name, summary, body, status, approved_at)
  values (p4, 'Project Helios',
    'Owned the Terraform modules behind fully reproducible environments.',
    e'Maria designed the **Terraform module library** for Helios. Spinning up an identical environment dropped from days to minutes.',
    'approved', now())
  returning id into t5;

  insert into public.testimonials (person_id, project_name, summary, body, status, approved_at)
  values (p5, 'Project Helios',
    'Set up observability that cut mean-time-to-recovery by 60%.',
    e'Tom rolled out **metrics, tracing and alerting** across Helios. MTTR fell ~60% and on-call nights got a lot quieter.',
    'approved', now())
  returning id into t6;

  insert into public.testimonials (person_id, project_name, summary, body, status, approved_at)
  values (p6, 'Project Helios',
    'Led the team and kept the migration on time and on budget.',
    e'Priya led the Helios engineering team end to end — **on time, on budget, zero downtime**, and a happy client at the end of it.',
    'approved', now())
  returning id into t7;

  insert into public.testimonial_tags (testimonial_id, filter_option_id) values
    (t4, fo_aws), (t4, fo_k8s),
    (t5, fo_aws), (t5, fo_tf),
    (t6, fo_aws), (t6, fo_k8s),
    (t7, fo_fin), (t7, fo_senior);

  insert into public.success_stories
    (title, project_name, client_name, client_alias, industry, summary,
     challenge, solution, results, duration, status, is_public, approved_at)
  values (
    'Project Helios — Zero-downtime Kubernetes migration',
    'Project Helios',
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
    (s1, p6, '', 'Engineering Lead', 'Ran delivery end to end.', 1),
    (s1, null, 'External Auditor', 'Compliance', 'Signed off the security review.', 2);

  insert into public.story_tags (story_id, filter_option_id) values
    (s1, fo_aws), (s1, fo_k8s), (s1, fo_tf), (s1, fo_fin);
end $$;
