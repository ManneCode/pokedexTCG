-- Resumen de cada colección para la página "Explorar coleccionistas" y su ranking.
-- Córrelo una vez en el SQL Editor después de schema.sql.
-- La app llena estas columnas cada vez que guarda tu colección.

alter table public.collections
  add column if not exists with_card integer not null default 0,
  add column if not exists total_cards integer not null default 0,
  add column if not exists value_usd numeric(12, 2) not null default 0;

create index if not exists collections_public_with_card on public.collections (with_card desc) where is_public;
create index if not exists collections_public_value on public.collections (value_usd desc) where is_public;
create index if not exists collections_public_cards on public.collections (total_cards desc) where is_public;
create index if not exists collections_public_updated on public.collections (updated_at desc) where is_public;
