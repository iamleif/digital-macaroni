create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique,
  website_url text not null check (website_url ~ '^https?://'),
  short_description text,
  logo_source_url text check (logo_source_url is null or logo_source_url ~ '^https?://'),
  logo_storage_path text,
  logo_fetched_at timestamptz,
  logo_attribution text,
  discovered_from text not null default 'editorial',
  pipeline_status text not null default 'queued' check (
    pipeline_status in ('queued', 'researching', 'drafting', 'ready', 'published', 'paused', 'rejected')
  ),
  target_publish_date date,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.research_jobs (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'blocked', 'needs_review', 'approved', 'failed', 'cancelled')
  ),
  review_type text not null default 'research-based' check (
    review_type in ('hands-on', 'research-based', 'legacy-editorial')
  ),
  priority smallint not null default 3 check (priority between 1 and 5),
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crawl_runs (
  id bigint generated always as identity primary key,
  product_id bigint references public.products(id) on delete set null,
  research_job_id bigint references public.research_jobs(id) on delete set null,
  connector text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed', 'blocked')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pages_fetched integer not null default 0 check (pages_fetched >= 0),
  records_found integer not null default 0 check (records_found >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.research_sources (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  crawl_run_id bigint references public.crawl_runs(id) on delete set null,
  platform text not null,
  source_type text not null check (
    source_type in ('official', 'independent-review-platform', 'community', 'press', 'documentation', 'hands-on-test')
  ),
  url text not null check (url ~ '^https?://'),
  title text,
  author_name text,
  rating numeric(3, 2) check (rating is null or rating between 0 and 10),
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  excerpt text check (excerpt is null or char_length(excerpt) <= 600),
  summary text,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (product_id, url)
);

create table public.research_findings (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  finding_type text not null check (finding_type in ('fact', 'praise', 'complaint', 'conflict', 'unknown', 'editorial-note')),
  summary text not null,
  prevalence text check (prevalence in ('isolated', 'minority', 'mixed', 'common', 'dominant')),
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finding_sources (
  finding_id bigint not null references public.research_findings(id) on delete cascade,
  source_id bigint not null references public.research_sources(id) on delete cascade,
  primary key (finding_id, source_id)
);

create table public.articles (
  id bigint generated always as identity primary key,
  product_id bigint not null unique references public.products(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  description text not null,
  body_mdx text not null,
  verdict text not null,
  card_verdict text not null check (
    char_length(card_verdict) <= 64 and array_length(regexp_split_to_array(trim(card_verdict), '\s+'), 1) <= 9
  ),
  author_name text not null default 'Leif Johansen',
  status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  review_type text not null check (review_type in ('hands-on', 'research-based', 'legacy-editorial')),
  testing_disclosure text not null,
  featured boolean not null default false,
  published_on date,
  updated_on date,
  publish_at timestamptz,
  overall_score numeric(3, 1) check (overall_score is null or overall_score between 0 and 10),
  readability_grade numeric(4, 1),
  average_sentence_words numeric(5, 1),
  duplicate_similarity numeric(4, 3) check (duplicate_similarity is null or duplicate_similarity between 0 and 1),
  validation_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or (published_on is not null and publish_at is not null and overall_score is not null))
);

create table public.article_scores (
  article_id bigint primary key references public.articles(id) on delete cascade,
  onboarding numeric(3, 1) not null check (onboarding between 0 and 10),
  product numeric(3, 1) not null check (product between 0 and 10),
  support numeric(3, 1) not null check (support between 0 and 10),
  billing numeric(3, 1) not null check (billing between 0 and 10),
  rationale jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_citations (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.articles(id) on delete cascade,
  name text not null,
  url text not null check (url ~ '^https?://'),
  accessed_on date not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (article_id, url)
);

create table public.article_versions (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.articles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (article_id, version_number)
);

create trigger categories_set_updated_at before update on public.categories
for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function private.set_updated_at();
create trigger research_jobs_set_updated_at before update on public.research_jobs
for each row execute function private.set_updated_at();
create trigger research_findings_set_updated_at before update on public.research_findings
for each row execute function private.set_updated_at();
create trigger articles_set_updated_at before update on public.articles
for each row execute function private.set_updated_at();
create trigger article_scores_set_updated_at before update on public.article_scores
for each row execute function private.set_updated_at();

create index products_category_id_idx on public.products(category_id);
create index products_target_publish_date_idx on public.products(target_publish_date, id)
where pipeline_status in ('queued', 'researching', 'drafting', 'ready');
create index research_jobs_product_id_idx on public.research_jobs(product_id);
create index research_jobs_queue_idx on public.research_jobs(priority, scheduled_for, id)
where status = 'queued';
create unique index research_jobs_one_active_idx on public.research_jobs(product_id)
where status in ('queued', 'running', 'blocked', 'needs_review');
create index crawl_runs_product_id_idx on public.crawl_runs(product_id);
create index crawl_runs_research_job_id_idx on public.crawl_runs(research_job_id);
create index research_sources_product_id_idx on public.research_sources(product_id);
create index research_sources_crawl_run_id_idx on public.research_sources(crawl_run_id);
create index research_sources_platform_idx on public.research_sources(platform, product_id);
create index research_findings_product_id_idx on public.research_findings(product_id);
create index finding_sources_source_id_idx on public.finding_sources(source_id);
create index articles_publish_at_idx on public.articles(publish_at desc, id)
where status = 'published';
create index article_citations_article_id_idx on public.article_citations(article_id);
create index article_versions_article_id_idx on public.article_versions(article_id, version_number desc);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.research_jobs enable row level security;
alter table public.crawl_runs enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_findings enable row level security;
alter table public.finding_sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_scores enable row level security;
alter table public.article_citations enable row level security;
alter table public.article_versions enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.categories, public.products, public.articles, public.article_scores, public.article_citations to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy categories_public_read on public.categories
for select to anon, authenticated using (is_active = true);

create policy products_public_read on public.products
for select to anon, authenticated using (is_public = true);

create policy articles_public_read on public.articles
for select to anon, authenticated using (
  status = 'published' and publish_at <= now()
);

create policy article_scores_public_read on public.article_scores
for select to anon, authenticated using (
  exists (
    select 1 from public.articles
    where articles.id = article_scores.article_id
      and articles.status = 'published'
      and articles.publish_at <= now()
  )
);

create policy article_citations_public_read on public.article_citations
for select to anon, authenticated using (
  exists (
    select 1 from public.articles
    where articles.id = article_citations.article_id
      and articles.status = 'published'
      and articles.publish_at <= now()
  )
);

create view public.published_reviews
with (security_invoker = true)
as
select
  a.id,
  a.slug,
  a.title,
  a.description,
  a.body_mdx,
  a.verdict,
  a.card_verdict,
  a.author_name,
  a.review_type,
  a.testing_disclosure,
  a.featured,
  a.published_on,
  a.updated_on,
  a.publish_at,
  a.overall_score,
  p.name as product_name,
  p.website_url as product_url,
  p.logo_storage_path,
  c.name as category,
  s.onboarding,
  s.product,
  s.support,
  s.billing
from public.articles a
join public.products p on p.id = a.product_id
join public.categories c on c.id = p.category_id
join public.article_scores s on s.article_id = a.id
where a.status = 'published' and a.publish_at <= now();

grant select on public.published_reviews to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-icons',
  'product-icons',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.categories (slug, name) values
  ('ai-tools', 'AI tools'),
  ('accounting-finance', 'Accounting & finance'),
  ('analytics-business-intelligence', 'Analytics & business intelligence'),
  ('business-phone', 'Business phone'),
  ('cms-website-builders', 'CMS & website builders'),
  ('crm-sales', 'CRM & sales'),
  ('customer-support', 'Customer support'),
  ('cybersecurity', 'Cybersecurity'),
  ('design-creative', 'Design & creative'),
  ('developer-tools', 'Developer tools'),
  ('e-commerce', 'E-commerce'),
  ('education', 'Education'),
  ('email-marketing', 'Email marketing'),
  ('hr-recruiting', 'HR & recruiting'),
  ('knowledge-management', 'Knowledge management'),
  ('legal', 'Legal'),
  ('marketing', 'Marketing'),
  ('no-code-automation', 'No-code & automation'),
  ('productivity', 'Productivity'),
  ('project-management', 'Project management'),
  ('property-management', 'Property management'),
  ('scheduling', 'Scheduling'),
  ('social-media', 'Social media'),
  ('video-audio', 'Video & audio');

with seed(slug, name, website_url, category_slug, target_publish_date, pipeline_status, is_public) as (
  values
    ('chatgpt', 'ChatGPT', 'https://chatgpt.com', 'ai-tools', date '2026-02-15', 'queued', false),
    ('claude', 'Claude', 'https://claude.ai', 'ai-tools', date '2026-02-19', 'queued', false),
    ('perplexity', 'Perplexity', 'https://www.perplexity.ai', 'ai-tools', date '2026-02-23', 'queued', false),
    ('midjourney', 'Midjourney', 'https://www.midjourney.com', 'ai-tools', date '2026-02-27', 'queued', false),
    ('jasper', 'Jasper', 'https://www.jasper.ai', 'ai-tools', date '2026-03-03', 'queued', false),
    ('asana', 'Asana', 'https://asana.com', 'project-management', date '2026-03-07', 'queued', false),
    ('trello', 'Trello', 'https://trello.com', 'project-management', date '2026-03-11', 'queued', false),
    ('monday', 'monday.com', 'https://monday.com', 'project-management', date '2026-03-15', 'queued', false),
    ('clickup', 'ClickUp', 'https://clickup.com', 'project-management', date '2026-03-19', 'queued', false),
    ('airtable', 'Airtable', 'https://www.airtable.com', 'no-code-automation', date '2026-03-23', 'queued', false),
    ('coda', 'Coda', 'https://coda.io', 'knowledge-management', date '2026-03-27', 'queued', false),
    ('confluence', 'Confluence', 'https://www.atlassian.com/software/confluence', 'knowledge-management', date '2026-03-31', 'queued', false),
    ('webflow', 'Webflow', 'https://webflow.com', 'cms-website-builders', date '2026-04-04', 'queued', false),
    ('wordpress', 'WordPress.com', 'https://wordpress.com', 'cms-website-builders', date '2026-04-08', 'queued', false),
    ('contentful', 'Contentful', 'https://www.contentful.com', 'cms-website-builders', date '2026-04-12', 'queued', false),
    ('sanity', 'Sanity', 'https://www.sanity.io', 'cms-website-builders', date '2026-04-16', 'queued', false),
    ('framer', 'Framer', 'https://www.framer.com', 'cms-website-builders', date '2026-04-20', 'queued', false),
    ('hubspot', 'HubSpot', 'https://www.hubspot.com', 'crm-sales', date '2026-04-24', 'queued', false),
    ('salesforce', 'Salesforce', 'https://www.salesforce.com', 'crm-sales', date '2026-04-28', 'queued', false),
    ('pipedrive', 'Pipedrive', 'https://www.pipedrive.com', 'crm-sales', date '2026-05-02', 'queued', false),
    ('attio', 'Attio', 'https://attio.com', 'crm-sales', date '2026-05-06', 'queued', false),
    ('intercom', 'Intercom', 'https://www.intercom.com', 'customer-support', date '2026-05-10', 'queued', false),
    ('zendesk', 'Zendesk', 'https://www.zendesk.com', 'customer-support', date '2026-05-14', 'queued', false),
    ('freshdesk', 'Freshdesk', 'https://www.freshworks.com/freshdesk', 'customer-support', date '2026-05-18', 'queued', false),
    ('help-scout', 'Help Scout', 'https://www.helpscout.com', 'customer-support', date '2026-05-22', 'queued', false),
    ('aircall', 'Aircall', 'https://aircall.io', 'business-phone', date '2026-05-26', 'queued', false),
    ('dialpad', 'Dialpad', 'https://www.dialpad.com', 'business-phone', date '2026-05-30', 'queued', false),
    ('slack', 'Slack', 'https://slack.com', 'productivity', date '2026-06-03', 'queued', false),
    ('microsoft-teams', 'Microsoft Teams', 'https://www.microsoft.com/en-us/microsoft-teams/group-chat-software', 'productivity', date '2026-06-07', 'queued', false),
    ('zapier', 'Zapier', 'https://zapier.com', 'no-code-automation', date '2026-06-11', 'queued', false),
    ('make', 'Make', 'https://www.make.com', 'no-code-automation', date '2026-06-15', 'queued', false),
    ('n8n', 'n8n', 'https://n8n.io', 'no-code-automation', date '2026-06-19', 'queued', false),
    ('canva', 'Canva', 'https://www.canva.com', 'design-creative', date '2026-06-23', 'queued', false),
    ('figma', 'Figma', 'https://www.figma.com', 'design-creative', date '2026-06-27', 'queued', false),
    ('adobe-express', 'Adobe Express', 'https://www.adobe.com/express/', 'design-creative', date '2026-07-01', 'queued', false),
    ('shopify', 'Shopify', 'https://www.shopify.com', 'e-commerce', date '2026-07-05', 'queued', false),
    ('squarespace', 'Squarespace', 'https://www.squarespace.com', 'cms-website-builders', date '2026-07-09', 'queued', false),
    ('quickbooks', 'QuickBooks', 'https://quickbooks.intuit.com', 'accounting-finance', date '2026-07-13', 'queued', false),
    ('xero', 'Xero', 'https://www.xero.com', 'accounting-finance', date '2026-07-17', 'queued', false),
    ('rippling', 'Rippling', 'https://www.rippling.com', 'hr-recruiting', date '2026-07-21', 'queued', false),
    ('gusto', 'Gusto', 'https://gusto.com', 'hr-recruiting', date '2026-07-25', 'queued', false),
    ('bamboohr', 'BambooHR', 'https://www.bamboohr.com', 'hr-recruiting', date '2026-07-29', 'queued', false),
    ('calendly', 'Calendly', 'https://calendly.com', 'scheduling', date '2026-08-01', 'queued', false),
    ('lodgify', 'Lodgify', 'https://www.lodgify.com', 'property-management', date '2026-08-03', 'queued', false),
    ('buildium', 'Buildium', 'https://www.buildium.com', 'property-management', date '2026-08-05', 'queued', false),
    ('appfolio', 'AppFolio', 'https://www.appfolio.com', 'property-management', date '2026-08-07', 'queued', false),
    ('onepassword', '1Password', 'https://1password.com', 'cybersecurity', date '2026-08-08', 'queued', false),
    ('notion', 'Notion', 'https://www.notion.so', 'knowledge-management', date '2026-08-09', 'published', true),
    ('openphone', 'OpenPhone', 'https://www.openphone.com', 'business-phone', date '2026-08-11', 'published', true),
    ('linear', 'Linear', 'https://linear.app', 'project-management', date '2026-08-13', 'published', true)
)
insert into public.products (
  slug, name, website_url, category_id, target_publish_date, pipeline_status, is_public, discovered_from
)
select
  seed.slug,
  seed.name,
  seed.website_url,
  categories.id,
  seed.target_publish_date,
  seed.pipeline_status,
  seed.is_public,
  'six-month editorial seed'
from seed
join public.categories on categories.slug = seed.category_slug;

insert into public.research_jobs (product_id, status, review_type, priority, scheduled_for)
select
  products.id,
  'queued',
  'research-based',
  case
    when products.target_publish_date <= date '2026-04-30' then 1
    when products.target_publish_date <= date '2026-06-30' then 2
    else 3
  end,
  products.target_publish_date
from public.products products
where products.pipeline_status = 'queued';
