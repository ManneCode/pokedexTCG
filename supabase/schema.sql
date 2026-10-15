-- Esquema de Pokédex TCG para Supabase.
-- Córrelo una vez en el SQL Editor de tu proyecto (Dashboard → SQL Editor → New query).

-- Perfil público de cada usuario: su nombre de usuario da la URL /u/<username>.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

-- La colección completa de cada usuario como un documento JSON
-- (el mismo formato que el respaldo que exporta la app).
create table if not exists public.collections (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.collections enable row level security;

-- Cualquiera puede ver perfiles; cada quien crea y edita solo el suyo.
create policy "perfiles visibles para todos" on public.profiles
  for select using (true);
create policy "crear mi perfil" on public.profiles
  for insert with check (auth.uid() = id);
create policy "editar mi perfil" on public.profiles
  for update using (auth.uid() = id);

-- Las colecciones públicas las ve cualquiera; las privadas solo su dueño.
create policy "ver colecciones públicas o la mía" on public.collections
  for select using (is_public or auth.uid() = user_id);
create policy "crear mi colección" on public.collections
  for insert with check (auth.uid() = user_id);
create policy "editar mi colección" on public.collections
  for update using (auth.uid() = user_id);
