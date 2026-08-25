alter table private.editorial_validations
  drop constraint editorial_validations_validator_identity_check;

alter table private.editorial_validations
  add constraint editorial_validations_validator_identity_check
  check (validator_version in ('editorial-contract-v1', 'editorial-contract-v2'));

comment on constraint editorial_validations_validator_identity_check on private.editorial_validations is
  'Preserves historical v1 receipts while allowing the stricter v2 validator for new editorial runs.';
