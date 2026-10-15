-- Buzón de sugerencias y reportes de bugs.
-- Córrelo una vez en el SQL Editor después de schema.sql.
-- Los mensajes se leen en Table Editor → feedback (nadie puede leerlos desde la página).

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('suggestion', 'bug', 'other')),
  message text not null check (char_length(message) between 5 and 2000),
  contact text check (contact is null or char_length(contact) <= 200),
  page text check (page is null or char_length(page) <= 300),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  user_id uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Cualquiera (con o sin cuenta) puede enviar; nadie puede leer, editar ni borrar desde la API.
create policy "enviar sugerencias" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
