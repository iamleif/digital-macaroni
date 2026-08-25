-- UPDATE OF guards do not run for INSERT. Keep new products from entering a
-- public state before their exact article body completes the editorial run.
create trigger products_enforce_editorial_gate_on_insert
before insert on public.products
for each row execute function private.enforce_product_publication_gate();
