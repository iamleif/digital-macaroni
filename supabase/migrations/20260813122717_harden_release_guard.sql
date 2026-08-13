alter function private.enforce_article_release_date() security definer;

revoke execute on function private.enforce_article_release_date() from public, anon, authenticated;

comment on function private.enforce_article_release_date() is
  'Security-definer trigger guard. Reads internal release evidence without exposing that evidence through the public API.';
