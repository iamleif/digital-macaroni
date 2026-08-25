alter table private.editorial_artifacts
  drop constraint editorial_artifacts_stage_check;

alter table private.editorial_artifacts
  add constraint editorial_artifacts_stage_check check (stage in (
    'research_brief',
    'source_packet',
    'writer_notebook',
    'argument_card',
    'spoken_brief',
    'raw_draft',
    'copy_edit',
    'humanized_draft',
    'humanizer_report',
    'final_draft'
  ));

create or replace function private.editorial_stage_position(candidate text)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select array_position(
    array[
      'research_brief',
      'source_packet',
      'writer_notebook',
      'argument_card',
      'spoken_brief',
      'raw_draft',
      'copy_edit',
      'humanized_draft',
      'humanizer_report',
      'final_draft'
    ]::text[],
    candidate
  );
$$;

create or replace function private.enforce_editorial_artifact_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.editorial_runs%rowtype;
  expected_position integer;
  predecessor_stage text;
  predecessor_hash text;
  supplied_hash text;
begin
  select * into run_record
  from private.editorial_runs
  where id = new.run_id
  for update;

  if run_record.id is null then
    raise exception 'Editorial run % does not exist', new.run_id;
  end if;

  if run_record.status not in ('researching', 'drafting') then
    raise exception 'Editorial run % is immutable in status %', new.run_id, run_record.status;
  end if;

  select coalesce(max(private.editorial_stage_position(stage)), 0) + 1
  into expected_position
  from private.editorial_artifacts
  where run_id = new.run_id;

  if private.editorial_stage_position(new.stage) <> expected_position then
    raise exception 'Stage % is out of order for run %; expected position %',
      new.stage, new.run_id, expected_position;
  end if;

  if new.stage = 'research_brief' then
    if coalesce((new.metadata ->> 'sourceCount')::integer, 0) < 6
       or coalesce((new.metadata ->> 'independentSourceCount')::integer, 0) < 2
       or coalesce((new.metadata ->> 'researchJobId')::bigint, 0) <= 0 then
      raise exception 'Research brief must identify its job, at least 6 sources, and at least 2 independent sources';
    end if;
    return new;
  end if;

  predecessor_stage := case new.stage
    when 'source_packet' then 'research_brief'
    when 'writer_notebook' then 'source_packet'
    when 'argument_card' then 'writer_notebook'
    when 'spoken_brief' then 'argument_card'
    when 'raw_draft' then 'spoken_brief'
    when 'copy_edit' then 'raw_draft'
    when 'humanized_draft' then 'copy_edit'
    when 'humanizer_report' then 'humanized_draft'
    when 'final_draft' then 'humanizer_report'
  end;

  select content_sha256 into predecessor_hash
  from private.editorial_artifacts
  where run_id = new.run_id and stage = predecessor_stage;

  supplied_hash := new.metadata ->> 'predecessorSha256';
  if supplied_hash is distinct from predecessor_hash then
    raise exception 'Stage % is not fingerprint-bound to predecessor %', new.stage, predecessor_stage;
  end if;

  if new.stage = 'writer_notebook'
     and (new.metadata ->> 'reviewWriterSha256') is distinct from run_record.review_writer_sha256 then
    raise exception 'Writer notebook does not match the run writer skill fingerprint';
  end if;

  if new.stage in ('humanized_draft', 'humanizer_report')
     and (new.metadata ->> 'humanizerSha256') is distinct from run_record.humanizer_sha256 then
    raise exception 'Stage % does not match the run Humanizer skill fingerprint', new.stage;
  end if;

  if new.stage = 'humanizer_report'
     and coalesce((new.metadata ->> 'passed')::boolean, false) is not true then
    raise exception 'Humanizer report did not pass';
  end if;

  if new.stage = 'final_draft' then
    select content_sha256 into predecessor_hash
    from private.editorial_artifacts
    where run_id = new.run_id and stage = 'humanized_draft';

    if encode(extensions.digest(new.content, 'sha256'), 'hex') <> predecessor_hash then
      raise exception 'Final draft changed after the Humanizer reviewed the exact body';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.enforce_article_editorial_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.editorial_runs%rowtype;
  final_hash text;
  required_artifact_count integer;
  has_approval boolean;
  has_validation boolean;
begin
  if new.status not in ('scheduled', 'published') then
    return new;
  end if;

  if new.editorial_run_id is null then
    raise exception 'Article % has no enforced editorial run', new.slug;
  end if;

  select * into run_record
  from private.editorial_runs
  where id = new.editorial_run_id;

  if run_record.id is null
     or run_record.product_id <> new.product_id
     or run_record.slug <> new.slug then
    raise exception 'Editorial run does not belong to article %', new.slug;
  end if;

  if run_record.status not in ('validated', 'published') then
    raise exception 'Article % cannot publish from editorial status %', new.slug, run_record.status;
  end if;

  if new.published_on <> run_record.publication_date then
    raise exception 'Article % must preserve editorial publication date %', new.slug, run_record.publication_date;
  end if;

  final_hash := encode(extensions.digest(new.body_mdx, 'sha256'), 'hex');

  if new.approved_body_sha256 is distinct from final_hash
     or run_record.final_body_sha256 is distinct from final_hash
     or run_record.approved_body_sha256 is distinct from final_hash
     or run_record.validated_body_sha256 is distinct from final_hash then
    raise exception 'Article % body does not match its approved and validated fingerprint', new.slug;
  end if;

  select count(*) into required_artifact_count
  from private.editorial_artifacts
  where run_id = new.editorial_run_id;

  if required_artifact_count <> 10 then
    raise exception 'Article % has % of 10 required editorial artifacts', new.slug, required_artifact_count;
  end if;

  select exists (
    select 1 from private.editorial_approvals
    where run_id = new.editorial_run_id and body_sha256 = final_hash
  ) into has_approval;

  select exists (
    select 1 from private.editorial_validations
    where run_id = new.editorial_run_id and body_sha256 = final_hash and passed
  ) into has_validation;

  if not has_approval or not has_validation then
    raise exception 'Article % is missing exact-body approval or validation', new.slug;
  end if;

  return new;
end;
$$;
