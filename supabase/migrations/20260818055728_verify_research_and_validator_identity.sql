alter table private.editorial_validations
  add constraint editorial_validations_validator_identity_check
  check (validator_version = 'editorial-contract-v1');

create or replace function private.verify_editorial_research_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_product_id bigint;
  job_product_id bigint;
  job_status text;
  actual_source_count integer;
  actual_independent_count integer;
begin
  if new.stage <> 'research_brief' then
    return new;
  end if;

  select product_id into run_product_id
  from private.editorial_runs
  where id = new.run_id;

  select product_id, status
  into job_product_id, job_status
  from public.research_jobs
  where id = (new.metadata ->> 'researchJobId')::bigint;

  if job_product_id is distinct from run_product_id or job_status <> 'approved' then
    raise exception 'Research brief must reference an approved research job for the same product';
  end if;

  select
    count(*),
    count(*) filter (where source_type <> 'official')
  into actual_source_count, actual_independent_count
  from public.research_sources
  where product_id = run_product_id
    and excerpt is not null
    and length(btrim(excerpt)) >= 20;

  if actual_source_count < (new.metadata ->> 'sourceCount')::integer
     or actual_independent_count < (new.metadata ->> 'independentSourceCount')::integer then
    raise exception 'Claimed research counts exceed excerpt-backed Supabase sources';
  end if;

  return new;
end;
$$;

create trigger editorial_artifacts_verify_research
before insert on private.editorial_artifacts
for each row execute function private.verify_editorial_research_evidence();

revoke execute on function private.verify_editorial_research_evidence() from public, anon, authenticated;
