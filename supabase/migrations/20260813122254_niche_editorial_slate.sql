alter table public.products
  add column selection_reason text;

create table private.product_release_records (
  product_id bigint primary key references public.products(id) on delete cascade,
  released_on date not null,
  date_precision text not null check (date_precision in ('day', 'month', 'year')),
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null default now(),
  notes text
);

revoke all on private.product_release_records from public, anon, authenticated;

alter table public.research_sources
  drop constraint research_sources_source_type_check,
  add constraint research_sources_source_type_check check (
    source_type in (
      'official', 'launch-history', 'independent-review-platform', 'community',
      'editorial-review', 'press', 'documentation', 'hands-on-test'
    )
  );

insert into private.product_release_records (product_id, released_on, date_precision, source_url, notes)
select id, date '2020-06-30', 'day', 'https://linear.app/changelog/2020-06-30',
  'Linear official changelog identifies this as the public launch and general availability date.'
from public.products
where slug = 'linear'
on conflict (product_id) do update set
  released_on = excluded.released_on,
  date_precision = excluded.date_precision,
  source_url = excluded.source_url,
  verified_at = now(),
  notes = excluded.notes;

update public.products
set pipeline_status = 'paused', target_publish_date = null, is_public = false
where slug = 'notion';

update public.articles
set status = 'archived', featured = false, publish_at = null
where slug = 'notion';

with slate(slug, name, website_url, category_slug, selection_reason) as (
  values
    ('typingmind', 'TypingMind', 'https://www.typingmind.com', 'ai-tools', 'Focused AI workspace with enough real users for a useful independent review.'),
    ('recall', 'Recall', 'https://www.getrecall.ai', 'ai-tools', 'Smaller AI knowledge tool with a clear job and meaningful alternatives.'),
    ('saner-ai', 'Saner.AI', 'https://www.saner.ai', 'ai-tools', 'Emerging AI personal knowledge product outside the household-name group.'),
    ('voicenotes', 'Voicenotes', 'https://voicenotes.com', 'ai-tools', 'Focused voice-to-notes product with an active independent user base.'),
    ('wispr-flow', 'Wispr Flow', 'https://wisprflow.ai', 'ai-tools', 'Fast-growing voice input utility with a narrow, testable promise.'),

    ('blue', 'Blue', 'https://www.blue.cc', 'project-management', 'Independent project tool positioned below the best-known incumbents.'),
    ('plane', 'Plane', 'https://plane.so', 'project-management', 'Open-source project platform with a distinct audience and workflow.'),
    ('fibery', 'Fibery', 'https://fibery.io', 'project-management', 'Flexible work platform with strong opinions and a smaller expert audience.'),
    ('morgen', 'Morgen', 'https://www.morgen.so', 'productivity', 'Focused calendar and task product with a practical cross-platform use case.'),
    ('akiflow', 'Akiflow', 'https://akiflow.com', 'productivity', 'Specialist daily-planning tool with enough depth for hands-on testing.'),

    ('assistloop', 'AssistLoop', 'https://assistloop.ai', 'customer-support', 'Newer AI support product discovered outside the large software directories.'),
    ('featureshift', 'FeatureShift', 'https://featureshift.com', 'customer-support', 'Smaller feedback tool with a clear product-management audience.'),
    ('productlift', 'ProductLift', 'https://www.productlift.dev', 'customer-support', 'Independent feedback and roadmap product with a focused customer base.'),
    ('frill', 'Frill', 'https://frill.co', 'customer-support', 'Mid-sized customer-feedback tool that competes with better-known products.'),
    ('productbridge', 'ProductBridge', 'https://productbridge.com', 'customer-support', 'Emerging feedback product suitable for evidence-led comparison.'),

    ('deftform', 'Deftform', 'https://deftform.com', 'no-code-automation', 'Independent form builder with a simple promise that can be tested directly.'),
    ('fillout', 'Fillout', 'https://www.fillout.com', 'no-code-automation', 'Growing form product that is known in its niche but not a household name.'),
    ('tally', 'Tally', 'https://tally.so', 'no-code-automation', 'Independent form product with a large enough community for broad evidence.'),
    ('noloco', 'Noloco', 'https://noloco.io', 'no-code-automation', 'No-code internal-tool builder serving a defined small-business audience.'),
    ('weweb', 'WeWeb', 'https://www.weweb.io', 'no-code-automation', 'Specialist no-code front end with a technical but non-mainstream audience.'),

    ('bento', 'Bento', 'https://bentonow.com', 'email-marketing', 'Independent email platform with a strong point of view and smaller customer base.'),
    ('plunk', 'Plunk', 'https://www.useplunk.com', 'email-marketing', 'Developer-friendly email tool that sits outside the major email brands.'),
    ('encharge', 'Encharge', 'https://encharge.io', 'email-marketing', 'Mid-market automation product with enough user history to evaluate.'),
    ('senja', 'Senja', 'https://senja.io', 'marketing', 'Focused testimonial product with a clear job and visible creator audience.'),
    ('dub', 'Dub', 'https://dub.co', 'marketing', 'Modern link platform with an emerging independent and developer audience.'),

    ('folk', 'folk', 'https://www.folk.app', 'crm-sales', 'Smaller collaborative CRM positioned away from enterprise incumbents.'),
    ('salesflare', 'Salesflare', 'https://salesflare.com', 'crm-sales', 'Established small-business CRM that remains below household-name scale.'),
    ('breakcold', 'Breakcold', 'https://www.breakcold.com', 'crm-sales', 'Emerging social-selling CRM with a focused and testable workflow.'),
    ('twenty', 'Twenty', 'https://twenty.com', 'crm-sales', 'Open-source CRM with a growing technical community and distinct model.'),
    ('waalaxy', 'Waalaxy', 'https://www.waalaxy.com', 'crm-sales', 'Specialist prospecting tool with broad user feedback and clear risks to assess.'),

    ('tidycal', 'TidyCal', 'https://tidycal.com', 'scheduling', 'Affordable scheduling product aimed at small teams and solo operators.'),
    ('breezedoc', 'BreezeDoc', 'https://breezedoc.com', 'legal', 'Simple e-signature tool from a smaller independent software company.'),
    ('documenso', 'Documenso', 'https://documenso.com', 'legal', 'Open-source document signing product with a distinct alternative model.'),
    ('moxie', 'Moxie', 'https://www.withmoxie.com', 'productivity', 'Small-business operations suite built for freelancers rather than enterprises.'),
    ('missive', 'Missive', 'https://missiveapp.com', 'productivity', 'Independent team inbox with a loyal niche and deep daily workflow.'),

    ('screenshotone', 'ScreenshotOne', 'https://screenshotone.com', 'developer-tools', 'Narrow developer API that can be tested against a concrete promise.'),
    ('openstatus', 'OpenStatus', 'https://www.openstatus.dev', 'developer-tools', 'Open-source monitoring product with a smaller technical community.'),
    ('trigger-dev', 'Trigger.dev', 'https://trigger.dev', 'developer-tools', 'Emerging background-jobs platform with an active developer audience.'),
    ('unkey', 'Unkey', 'https://www.unkey.com', 'developer-tools', 'Focused API-key infrastructure product outside the major cloud platforms.'),
    ('logto', 'Logto', 'https://logto.io', 'developer-tools', 'Open-source identity tool with enough technical depth for a useful review.'),

    ('hospitable', 'Hospitable', 'https://hospitable.com', 'property-management', 'Specialist short-term rental tool with strong real-world operator feedback.'),
    ('landlord-studio', 'Landlord Studio', 'https://www.landlordstudio.com', 'property-management', 'Focused landlord software serving small property portfolios.'),
    ('tenantcloud', 'TenantCloud', 'https://www.tenantcloud.com', 'property-management', 'Mid-sized rental platform with a broad base of landlord reviews.'),
    ('innago', 'Innago', 'https://innago.com', 'property-management', 'Independent landlord platform with a distinctive free-pricing promise.'),
    ('baselane', 'Baselane', 'https://www.baselane.com', 'property-management', 'Financial operations product built specifically for independent landlords.'),

    ('tella', 'Tella', 'https://www.tella.tv', 'video-audio', 'Focused screen-recording product for creators and small teams.'),
    ('screen-studio', 'Screen Studio', 'https://screen.studio', 'video-audio', 'Independent screen recorder with a clear design-led promise.'),
    ('jitter', 'Jitter', 'https://jitter.video', 'design-creative', 'Browser motion-design tool that serves a specialist creative audience.'),
    ('guidde', 'Guidde', 'https://www.guidde.com', 'video-audio', 'AI documentation video tool with a focused business use case.'),
    ('claap', 'Claap', 'https://www.claap.io', 'video-audio', 'Smaller async-video product with a clear team collaboration promise.')
)
insert into public.products (
  slug, name, website_url, category_id, short_description, discovered_from,
  pipeline_status, target_publish_date, is_public, selection_reason
)
select
  slate.slug,
  slate.name,
  slate.website_url,
  categories.id,
  slate.selection_reason,
  'Digital Macaroni niche editorial slate 2026-08',
  'queued',
  null,
  false,
  slate.selection_reason
from slate
join public.categories as categories on categories.slug = slate.category_slug
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  category_id = excluded.category_id,
  short_description = excluded.short_description,
  discovered_from = excluded.discovered_from,
  pipeline_status = 'queued',
  target_publish_date = null,
  is_public = false,
  selection_reason = excluded.selection_reason;

insert into public.research_jobs (product_id, status, review_type, priority, scheduled_for, config)
select
  products.id,
  'queued',
  'research-based',
  3,
  null,
  jsonb_build_object(
    'releaseDateRequired', true,
    'minimumTotalSources', 6,
    'minimumIndependentPlatforms', 2,
    'minimumCommunitySources', 1,
    'minimumVoiceSamples', 20
  )
from public.products
where products.discovered_from = 'Digital Macaroni niche editorial slate 2026-08'
  and not exists (
    select 1 from public.research_jobs
    where research_jobs.product_id = products.id
      and research_jobs.status in ('queued', 'running', 'blocked', 'needs_review')
  );

create or replace function private.enforce_article_release_date()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  product_release date;
  product_release_verified_at timestamptz;
begin
  if new.status = 'published' and new.review_type <> 'legacy-editorial' then
    select released_on, verified_at
    into product_release, product_release_verified_at
    from private.product_release_records
    where product_id = new.product_id;

    if product_release is null or product_release_verified_at is null then
      raise exception 'A verified product release date is required before publishing review %', new.slug;
    end if;

    if new.published_on < product_release then
      raise exception 'Review % cannot publish on % before product release %', new.slug, new.published_on, product_release;
    end if;
  end if;

  return new;
end;
$$;

create trigger articles_enforce_release_date
before insert or update of status, published_on, product_id, review_type on public.articles
for each row execute function private.enforce_article_release_date();

comment on table private.product_release_records is 'Internal-only release-date evidence used to prevent impossible editorial dates. Never rendered publicly.';
comment on function private.enforce_article_release_date() is 'Blocks non-legacy publication without a sourced release date and blocks review dates before release.';
