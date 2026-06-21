-- Optional sample data for local development / first look at the wall.
-- Safe to skip in production. Run after 0001_init.sql.

do $$
declare
  p1 uuid; p2 uuid;
  t1 uuid; t2 uuid; t3 uuid;
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
end $$;
