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

-- Trip window: only days in this range can be claimed or noted.
-- Keep in sync with TRIP_START / TRIP_END in config.js, then re-run this file.
create table if not exists public.trip_window (
  id boolean primary key default true check (id), -- single row
  start_day date not null,
  end_day date not null check (end_day >= start_day)
);
insert into public.trip_window (id, start_day, end_day)
values (true, '2026-10-19', '2026-10-28')
on conflict (id) do update set start_day = excluded.start_day, end_day = excluded.end_day;

-- Not readable by the public key; the check below runs with owner rights.
alter table public.trip_window enable row level security;
revoke all on public.trip_window from anon, authenticated;

create or replace function public.check_trip_day() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  w public.trip_window;
begin
  select * into w from public.trip_window where id;
  if w is null or new.day < w.start_day or new.day > w.end_day then
    raise exception 'Date % is outside the trip (% to %)', new.day, w.start_day, w.end_day
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.check_trip_day() from public, anon, authenticated;

drop trigger if exists claims_trip_day on public.claims;
create trigger claims_trip_day before insert or update on public.claims
  for each row execute function public.check_trip_day();

drop trigger if exists day_notes_trip_day on public.day_notes;
create trigger day_notes_trip_day before insert or update on public.day_notes
  for each row execute function public.check_trip_day();

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
