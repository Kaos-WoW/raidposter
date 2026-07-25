-- Einmalig im Supabase-Dashboard unter "SQL Editor" -> "New query" einfügen und ausführen.

create table if not exists shared_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table shared_state enable row level security;

create policy "Authenticated read" on shared_state
  for select using (auth.role() = 'authenticated');

create policy "Authenticated insert" on shared_state
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated update" on shared_state
  for update using (auth.role() = 'authenticated');

-- Live-Sync aktivieren
alter publication supabase_realtime add table shared_state;

-- Startwerte anlegen, damit die Seite beim ersten Laden nicht ins Leere läuft
insert into shared_state (key, value) values
  ('session', '{}'::jsonb),
  ('classbook', '{}'::jsonb),
  ('rolebook', '{}'::jsonb),
  ('webhooks', '{}'::jsonb)
on conflict (key) do nothing;
