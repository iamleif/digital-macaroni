-- The original seed was useful for exercising the pipeline, but it does not
-- match Digital Macaroni's editorial focus on smaller, overlooked products.
-- Preserve the records and collected evidence while preventing any jobs from
-- being researched or published automatically.
update public.research_jobs
set
  status = 'cancelled',
  updated_at = now()
where status = 'queued'
  and product_id in (
    select id
    from public.products
    where discovered_from = 'six-month editorial seed'
      and pipeline_status = 'queued'
  );

update public.products
set
  pipeline_status = 'paused',
  discovered_from = 'broad-market seed (paused)',
  updated_at = now()
where discovered_from = 'six-month editorial seed'
  and pipeline_status = 'queued';
