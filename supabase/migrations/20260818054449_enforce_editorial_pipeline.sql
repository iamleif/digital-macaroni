-- A publication is no longer a status flip. It is the terminal transition of an
-- immutable editorial run whose final body was explicitly approved and validated.

create table private.editorial_runs (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  publication_date date not null,
  status text not null default 'researching' check (
    status in ('researching', 'drafting', 'awaiting_approval', 'approved', 'validated', 'published', 'blocked')
  ),
  review_writer_sha256 text not null check (review_writer_sha256 ~ '^[a-f0-9]{64}$'),
  humanizer_sha256 text not null check (humanizer_sha256 ~ '^[a-f0-9]{64}$'),
  final_body_sha256 text check (final_body_sha256 is null or final_body_sha256 ~ '^[a-f0-9]{64}$'),
  approved_body_sha256 text check (approved_body_sha256 is null or approved_body_sha256 ~ '^[a-f0-9]{64}$'),
  validated_body_sha256 text check (validated_body_sha256 is null or validated_body_sha256 ~ '^[a-f0-9]{64}$'),
  approved_by text,
  approved_at timestamptz,
  validated_at timestamptz,
  published_at timestamptz,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, product_id),
  unique (id, slug)
);

create unique index editorial_runs_one_open_per_product_idx
on private.editorial_runs(product_id)
where status <> 'published' and status <> 'blocked';

create table private.editorial_artifacts (
  id bigint generated always as identity primary key,
  run_id bigint not null references private.editorial_runs(id) on delete restrict,
  stage text not null check (stage in (
    'research_brief',
    'source_packet',
    'writer_notebook',
    'argument_card',
    'spoken_brief',
    'raw_draft',
    'copy_edit',
    'humanizer_report',
    'final_draft'
  )),
  content text not null check (length(btrim(content)) > 0),
  content_sha256 text generated always as (
    encode(extensions.digest(content, 'sha256'), 'hex')
  ) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, stage)
);

create table private.editorial_approvals (
  id bigint generated always as identity primary key,
  run_id bigint not null unique references private.editorial_runs(id) on delete restrict,
  body_sha256 text not null check (body_sha256 ~ '^[a-f0-9]{64}$'),
  approved_by text not null check (
    length(btrim(approved_by)) >= 3
    and lower(btrim(approved_by)) not in ('system', 'agent', 'automation', 'auto')
  ),
  approval_statement text not null check (length(btrim(approval_statement)) >= 12),
  created_at timestamptz not null default now()
);

create table private.editorial_validations (
  id bigint generated always as identity primary key,
  run_id bigint not null references private.editorial_runs(id) on delete restrict,
  body_sha256 text not null check (body_sha256 ~ '^[a-f0-9]{64}$'),
  validator_version text not null check (length(btrim(validator_version)) > 0),
  passed boolean not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create unique index editorial_validations_one_pass_idx
on private.editorial_validations(run_id)
where passed;

alter table public.articles
  add column editorial_run_id bigint references private.editorial_runs(id) on delete restrict,
  add column approved_body_sha256 text check (
    approved_body_sha256 is null or approved_body_sha256 ~ '^[a-f0-9]{64}$'
  ),
  add column body_sha256 text generated always as (
    encode(extensions.digest(body_mdx, 'sha256'), 'hex')
  ) stored;

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
  run_status text;
  expected_position integer;
begin
  select status into run_status
  from private.editorial_runs
  where id = new.run_id
  for update;

  if run_status is null then
    raise exception 'Editorial run % does not exist', new.run_id;
  end if;

  if run_status not in ('researching', 'drafting') then
    raise exception 'Editorial run % is immutable in status %', new.run_id, run_status;
  end if;

  select coalesce(max(private.editorial_stage_position(stage)), 0) + 1
  into expected_position
  from private.editorial_artifacts
  where run_id = new.run_id;

  if private.editorial_stage_position(new.stage) <> expected_position then
    raise exception 'Stage % is out of order for run %; expected position %',
      new.stage, new.run_id, expected_position;
  end if;

  return new;
end;
$$;

create or replace function private.advance_editorial_run_after_artifact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage = 'final_draft' then
    update private.editorial_runs
    set status = 'awaiting_approval',
        final_body_sha256 = new.content_sha256,
        updated_at = now()
    where id = new.run_id;
  elsif new.stage = 'raw_draft' then
    update private.editorial_runs
    set status = 'drafting', updated_at = now()
    where id = new.run_id;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_editorial_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.editorial_runs%rowtype;
begin
  select * into run_record
  from private.editorial_runs
  where id = new.run_id
  for update;

  if run_record.status <> 'awaiting_approval' then
    raise exception 'Run % cannot be approved from status %', new.run_id, run_record.status;
  end if;

  if new.body_sha256 <> run_record.final_body_sha256 then
    raise exception 'Approval fingerprint does not match final draft for run %', new.run_id;
  end if;

  return new;
end;
$$;

create or replace function private.advance_editorial_run_after_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.editorial_runs
  set status = 'approved',
      approved_body_sha256 = new.body_sha256,
      approved_by = new.approved_by,
      approved_at = new.created_at,
      updated_at = now()
  where id = new.run_id;
  return new;
end;
$$;

create or replace function private.enforce_editorial_validation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.editorial_runs%rowtype;
  required_check text;
begin
  select * into run_record
  from private.editorial_runs
  where id = new.run_id
  for update;

  if run_record.status <> 'approved' then
    raise exception 'Run % cannot be validated from status %', new.run_id, run_record.status;
  end if;

  if new.body_sha256 <> run_record.approved_body_sha256 then
    raise exception 'Validation fingerprint does not match approved draft for run %', new.run_id;
  end if;

  if new.passed then
    foreach required_check in array array[
      'structure', 'source_integrity', 'stance', 'buyer_guidance',
      'humanizer', 'similarity', 'readability', 'disclosure'
    ]::text[] loop
      if coalesce((new.report -> 'checks' ->> required_check)::boolean, false) is not true then
        raise exception 'Passing validation for run % is missing check %', new.run_id, required_check;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create or replace function private.advance_editorial_run_after_validation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.passed then
    update private.editorial_runs
    set status = 'validated',
        validated_body_sha256 = new.body_sha256,
        validated_at = new.created_at,
        updated_at = now()
    where id = new.run_id;
  end if;
  return new;
end;
$$;

create or replace function private.prevent_editorial_record_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception '% records are append-only', tg_table_name;
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

  if required_artifact_count <> 9 then
    raise exception 'Article % has % of 9 required editorial artifacts', new.slug, required_artifact_count;
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

create or replace function private.mark_editorial_run_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    update private.editorial_runs
    set status = 'published', published_at = now(), updated_at = now()
    where id = new.editorial_run_id and status = 'validated';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_product_publication_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pipeline_status = 'published' or new.is_public then
    if not exists (
      select 1
      from public.articles
      join private.editorial_runs on editorial_runs.id = articles.editorial_run_id
      where articles.product_id = new.id
        and articles.status = 'published'
        and editorial_runs.status = 'published'
    ) then
      raise exception 'Product % cannot be public before an enforced article publication', new.slug;
    end if;
  end if;
  return new;
end;
$$;

create trigger editorial_artifacts_enforce_sequence
before insert on private.editorial_artifacts
for each row execute function private.enforce_editorial_artifact_sequence();

create trigger editorial_artifacts_advance_run
after insert on private.editorial_artifacts
for each row execute function private.advance_editorial_run_after_artifact();

create trigger editorial_artifacts_append_only
before update or delete on private.editorial_artifacts
for each row execute function private.prevent_editorial_record_mutation();

create trigger editorial_approvals_enforce
before insert on private.editorial_approvals
for each row execute function private.enforce_editorial_approval();

create trigger editorial_approvals_advance_run
after insert on private.editorial_approvals
for each row execute function private.advance_editorial_run_after_approval();

create trigger editorial_approvals_append_only
before update or delete on private.editorial_approvals
for each row execute function private.prevent_editorial_record_mutation();

create trigger editorial_validations_enforce
before insert on private.editorial_validations
for each row execute function private.enforce_editorial_validation();

create trigger editorial_validations_advance_run
after insert on private.editorial_validations
for each row execute function private.advance_editorial_run_after_validation();

create trigger editorial_validations_append_only
before update or delete on private.editorial_validations
for each row execute function private.prevent_editorial_record_mutation();

create trigger articles_enforce_editorial_gate
before insert or update of product_id, slug, body_mdx, status, published_on, editorial_run_id, approved_body_sha256
on public.articles
for each row execute function private.enforce_article_editorial_gate();

create trigger articles_mark_editorial_run_published
after insert or update of status on public.articles
for each row execute function private.mark_editorial_run_published();

create trigger products_enforce_editorial_gate
before update of pipeline_status, is_public on public.products
for each row execute function private.enforce_product_publication_gate();

create trigger editorial_runs_set_updated_at
before update on private.editorial_runs
for each row execute function private.set_updated_at();

revoke all on private.editorial_runs from public, anon, authenticated;
revoke all on private.editorial_artifacts from public, anon, authenticated;
revoke all on private.editorial_approvals from public, anon, authenticated;
revoke all on private.editorial_validations from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

grant all on private.editorial_runs to service_role;
grant all on private.editorial_artifacts to service_role;
grant all on private.editorial_approvals to service_role;
grant all on private.editorial_validations to service_role;
grant usage, select on all sequences in schema private to service_role;

revoke execute on function private.editorial_stage_position(text) from public, anon, authenticated;
revoke execute on function private.enforce_editorial_artifact_sequence() from public, anon, authenticated;
revoke execute on function private.advance_editorial_run_after_artifact() from public, anon, authenticated;
revoke execute on function private.enforce_editorial_approval() from public, anon, authenticated;
revoke execute on function private.advance_editorial_run_after_approval() from public, anon, authenticated;
revoke execute on function private.enforce_editorial_validation() from public, anon, authenticated;
revoke execute on function private.advance_editorial_run_after_validation() from public, anon, authenticated;
revoke execute on function private.prevent_editorial_record_mutation() from public, anon, authenticated;
revoke execute on function private.enforce_article_editorial_gate() from public, anon, authenticated;
revoke execute on function private.mark_editorial_run_published() from public, anon, authenticated;
revoke execute on function private.enforce_product_publication_gate() from public, anon, authenticated;

comment on table private.editorial_runs is
  'Server-side state machine for review publication. A run is bound to exact writer and Humanizer skill fingerprints.';
comment on table private.editorial_artifacts is
  'Immutable, ordered editorial evidence. Missing or out-of-order stages block approval and publication.';
comment on table private.editorial_approvals is
  'Explicit human approval of the exact final-draft SHA-256 fingerprint.';
comment on table private.editorial_validations is
  'Append-only validator results bound to the approved final-draft SHA-256 fingerprint.';
