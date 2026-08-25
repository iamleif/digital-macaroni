begin;

do $$
declare
  test_category_id bigint;
  test_product_id bigint;
  test_article_id bigint;
  test_run_id bigint;
  test_research_job_id bigint;
  final_body text := 'This is the exact final body used by the editorial gate test.';
  final_hash text;
  caught boolean;
  predecessor_hash text;
begin
  final_hash := encode(extensions.digest(final_body, 'sha256'), 'hex');

  -- A product cannot be born public without an enforced published article.
  caught := false;
  begin
    insert into public.categories (slug, name)
    values ('editorial-pipeline-test-invalid', 'Editorial Pipeline Test Invalid')
    returning id into test_category_id;

    insert into public.products (
      category_id, slug, name, website_url, pipeline_status, is_public
    ) values (
      test_category_id,
      'editorial-pipeline-test-invalid',
      'Editorial Pipeline Test Invalid',
      'https://example.com/invalid',
      'published',
      true
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'BYPASS: public product insert succeeded without an editorial run';
  end if;

  insert into public.categories (slug, name)
  values ('editorial-pipeline-test', 'Editorial Pipeline Test')
  returning id into test_category_id;

  insert into public.products (
    category_id, slug, name, website_url, pipeline_status, is_public
  ) values (
    test_category_id,
    'editorial-pipeline-test',
    'Editorial Pipeline Test',
    'https://example.com/editorial-pipeline-test',
    'drafting',
    false
  ) returning id into test_product_id;

  insert into private.product_release_records (
    product_id, released_on, date_precision, source_url, verified_at, notes
  ) values (
    test_product_id,
    '2020-01-01',
    'day',
    'https://example.com/release',
    now(),
    'Rolled-back enforcement test'
  );

  insert into public.research_jobs (product_id, status, review_type, completed_at)
  values (test_product_id, 'approved', 'research-based', now())
  returning id into test_research_job_id;

  insert into public.research_sources (
    product_id, platform, source_type, url, excerpt
  ) values
    (test_product_id, 'Official docs', 'official', 'https://example.com/source-1', 'Excerpt-backed source evidence number one for the database gate test.'),
    (test_product_id, 'Official pricing', 'official', 'https://example.com/source-2', 'Excerpt-backed source evidence number two for the database gate test.'),
    (test_product_id, 'Official help', 'documentation', 'https://example.com/source-3', 'Excerpt-backed source evidence number three for the database gate test.'),
    (test_product_id, 'Review forum', 'independent-review-platform', 'https://example.com/source-4', 'Excerpt-backed source evidence number four for the database gate test.'),
    (test_product_id, 'Community A', 'community', 'https://example.com/source-5', 'Excerpt-backed source evidence number five for the database gate test.'),
    (test_product_id, 'Community B', 'community', 'https://example.com/source-6', 'Excerpt-backed source evidence number six for the database gate test.');

  insert into private.editorial_runs (
    product_id,
    slug,
    publication_date,
    review_writer_sha256,
    humanizer_sha256
  ) values (
    test_product_id,
    'editorial-pipeline-test',
    current_date,
    repeat('a', 64),
    repeat('b', 64)
  ) returning id into test_run_id;

  -- Skipping directly to a draft must fail.
  caught := false;
  begin
    insert into private.editorial_artifacts (run_id, stage, content)
    values (test_run_id, 'raw_draft', 'Skipped every research stage');
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'BYPASS: out-of-order artifact insertion succeeded';
  end if;

  insert into public.articles (
    product_id, slug, title, description, body_mdx, verdict, card_verdict,
    status, review_type, testing_disclosure
  ) values (
    test_product_id,
    'editorial-pipeline-test',
    'Editorial Pipeline Test',
    'A deliberately temporary article.',
    'Unapproved body',
    'Temporary verdict',
    'Temporary verdict',
    'draft',
    'research-based',
    'This is a rolled-back database gate test.'
  ) returning id into test_article_id;

  -- A direct draft-to-published flip must fail.
  caught := false;
  begin
    update public.articles
    set status = 'published',
        published_on = current_date,
        publish_at = now(),
        overall_score = 7
    where id = test_article_id;
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'BYPASS: article published without editorial evidence';
  end if;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'research_brief',
    'Test artifact for research_brief',
    jsonb_build_object(
      'researchJobId', test_research_job_id,
      'sourceCount', 6,
      'independentSourceCount', 2
    )
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'source_packet',
    'Test artifact for source_packet',
    jsonb_build_object('predecessorSha256', predecessor_hash)
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'writer_notebook',
    'Test artifact for writer_notebook',
    jsonb_build_object('predecessorSha256', predecessor_hash, 'reviewWriterSha256', repeat('a', 64))
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'argument_card',
    'Test artifact for argument_card',
    jsonb_build_object('predecessorSha256', predecessor_hash)
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'spoken_brief',
    'Test artifact for spoken_brief',
    jsonb_build_object('predecessorSha256', predecessor_hash)
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'raw_draft',
    'Test artifact for raw_draft',
    jsonb_build_object('predecessorSha256', predecessor_hash)
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'copy_edit',
    'Test artifact for copy_edit',
    jsonb_build_object('predecessorSha256', predecessor_hash)
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'humanized_draft',
    final_body,
    jsonb_build_object(
      'predecessorSha256', predecessor_hash,
      'humanizerSha256', repeat('b', 64)
    )
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'humanizer_report',
    'Humanizer reviewed and passed the exact draft.',
    jsonb_build_object(
      'predecessorSha256', predecessor_hash,
      'humanizerSha256', repeat('b', 64),
      'passed', true
    )
  ) returning content_sha256 into predecessor_hash;

  insert into private.editorial_artifacts (run_id, stage, content, metadata)
  values (
    test_run_id,
    'final_draft',
    final_body,
    jsonb_build_object('predecessorSha256', predecessor_hash)
  );

  -- Approval of anything except the final fingerprint must fail.
  caught := false;
  begin
    insert into private.editorial_approvals (
      run_id, body_sha256, approved_by, approval_statement
    ) values (
      test_run_id,
      repeat('c', 64),
      'Leif Johansen',
      'I explicitly approve this exact article body.'
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'BYPASS: approval accepted the wrong body fingerprint';
  end if;

  insert into private.editorial_approvals (
    run_id, body_sha256, approved_by, approval_statement
  ) values (
    test_run_id,
    final_hash,
    'Leif Johansen',
    'I explicitly approve this exact article body.'
  );

  -- A bare passed=true flag is no longer a validation report.
  caught := false;
  begin
    insert into private.editorial_validations (
      run_id, body_sha256, validator_version, passed, report
    ) values (
      test_run_id,
      final_hash,
      'editorial-contract-v2',
      true,
      '{"checks": {}}'::jsonb
    );
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'BYPASS: empty validation report was accepted';
  end if;

  insert into private.editorial_validations (
    run_id, body_sha256, validator_version, passed, report
  ) values (
    test_run_id,
    final_hash,
    'editorial-contract-v2',
    true,
    '{
      "checks": {
        "structure": true,
        "source_integrity": true,
        "stance": true,
        "buyer_guidance": true,
        "humanizer": true,
        "similarity": true,
        "readability": true,
        "disclosure": true
      }
    }'::jsonb
  );

  update public.articles
  set body_mdx = final_body,
      status = 'published',
      published_on = current_date,
      publish_at = now(),
      overall_score = 7,
      editorial_run_id = test_run_id,
      approved_body_sha256 = final_hash
  where id = test_article_id;

  update public.products
  set pipeline_status = 'published', is_public = true
  where id = test_product_id;

  if (select status from private.editorial_runs where id = test_run_id) <> 'published' then
    raise exception 'VALID PATH FAILED: editorial run did not reach published';
  end if;

  -- A post-approval body change must fail even after publication.
  caught := false;
  begin
    update public.articles
    set body_mdx = final_body || ' Tampered.'
    where id = test_article_id;
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'BYPASS: published exact body was mutable';
  end if;

  -- Evidence itself is append-only.
  caught := false;
  begin
    update private.editorial_artifacts
    set content = 'Tampered artifact'
    where run_id = test_run_id and stage = 'research_brief';
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'BYPASS: immutable artifact was mutable';
  end if;

  raise notice 'PASS: all editorial pipeline bypass attempts were rejected and the valid path succeeded';
end;
$$;

rollback;
