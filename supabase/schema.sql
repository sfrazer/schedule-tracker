-- Dog-sitting schedule tracker schema.
-- Paste into the Supabase SQL editor and run once.

create table if not exists public.claims (
  day date not null,
  slot text not null check (slot in ('morning', 'midday', 'evening', 'overnight')),
  person text not null check (length(trim(person)) between 1 and 40),
  updated_at timestamptz not null default now(),
  primary key (day, slot)
);

create table if not exists public.day_notes (
  day date primary key,
  note text not null default '' check (length(note) <= 1000),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on upserts.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists claims_touch on public.claims;
create trigger claims_touch before update on public.claims
  for each row execute function public.touch_updated_at();

drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

-- Open access for anyone with the link (no login), limited to these two tables.
alter table public.claims enable row level security;
alter table public.day_notes enable row level security;

grant select, insert, update, delete on public.claims to anon;
grant select, insert, update, delete on public.day_notes to anon;

drop policy if exists "open access" on public.claims;
create policy "open access" on public.claims
  for all to anon using (true) with check (true);

drop policy if exists "open access" on public.day_notes;
create policy "open access" on public.day_notes
  for all to anon using (true) with check (true);

-- Push changes to open pages.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'claims') then
    alter publication supabase_realtime add table public.claims;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'day_notes') then
    alter publication supabase_realtime add table public.day_notes;
  end if;
end;
$$;
