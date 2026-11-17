-- Betly: Tageslotto. Ein Gratis-Schein pro Tag und Gerät, Ziehung täglich um 20:00 (Zürich).
-- Im Supabase-Dashboard unter «SQL Editor» einfügen und «Run» drücken. Mehrfach ausführen schadet nicht.

-- Der offene Spieltag: ab 20:00 Zürcher Zeit zählt schon der nächste Tag.
create or replace function public.lotto_day(t timestamptz default now()) returns date
language sql stable set search_path = '' as $$
  select ((t at time zone 'Europe/Zurich') + interval '4 hours')::date
$$;

-- Ein Schein pro Tag und Gerät (pid ist eine zufällige ID aus dem Browser, nicht öffentlich lesbar).
create table if not exists public.lotto_tickets (
  id bigint generated always as identity primary key,
  day date not null,
  pid text not null check (pid ~ '^[a-z0-9-]{8,64}$'),
  name text not null check (char_length(name) between 1 and 24),
  nums smallint[] not null,
  lucky smallint not null check (lucky between 1 and 6),
  user_id uuid,
  created_at timestamptz not null default now(),
  unique (day, pid)
);
create index if not exists lotto_tickets_day on public.lotto_tickets (day);

-- Server prüft: nur für den offenen Tag, 6 verschiedene Zahlen 1–42, Zeit und Konto vom Server.
create or replace function public.lotto_ticket_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.day <> public.lotto_day() then raise exception 'lotto closed for this day'; end if;
  if cardinality(new.nums) <> 6
     or (select count(distinct x) from unnest(new.nums) x where x between 1 and 42) <> 6 then
    raise exception 'invalid numbers';
  end if;
  new.nums := array(select x from unnest(new.nums) x order by x);
  new.created_at := now();
  new.user_id := auth.uid();
  return new;
end $$;
drop trigger if exists lotto_ticket_check on public.lotto_tickets;
create trigger lotto_ticket_check before insert on public.lotto_tickets
  for each row execute function public.lotto_ticket_check();

alter table public.lotto_tickets enable row level security;
drop policy if exists "read tickets" on public.lotto_tickets;
create policy "read tickets" on public.lotto_tickets for select to anon, authenticated using (true);
drop policy if exists "hand in" on public.lotto_tickets;
create policy "hand in" on public.lotto_tickets for insert to anon, authenticated with check (true);
revoke all on public.lotto_tickets from anon, authenticated;
grant select (id, day, name, nums, lucky, created_at) on public.lotto_tickets to anon, authenticated;
grant insert (day, pid, name, nums, lucky) on public.lotto_tickets to anon, authenticated;

-- Die Ziehungen. Niemand schreibt direkt; lotto_draw() zieht erst nach 20:00, einmal pro Tag.
create table if not exists public.lotto_draws (
  day date primary key,
  nums smallint[] not null, -- in Ziehungsreihenfolge
  lucky smallint not null,
  drawn_at timestamptz not null default now()
);
alter table public.lotto_draws enable row level security;
drop policy if exists "read draws" on public.lotto_draws;
create policy "read draws" on public.lotto_draws for select to anon, authenticated using (true);
revoke all on public.lotto_draws from anon, authenticated;
grant select on public.lotto_draws to anon, authenticated;

create or replace function public.lotto_draw(d date) returns public.lotto_draws
language plpgsql security definer set search_path = '' as $$
declare r public.lotto_draws;
begin
  if d >= public.lotto_day() or d < public.lotto_day() - 60 then return null; end if;
  insert into public.lotto_draws (day, nums, lucky)
    select d, array(select n::smallint from generate_series(1, 42) n order by random() limit 6), (1 + floor(random() * 6))::smallint
  on conflict (day) do nothing;
  select * into r from public.lotto_draws where day = d;
  return r;
end $$;
revoke all on function public.lotto_draw(date) from public;
grant execute on function public.lotto_draw(date) to anon, authenticated;

-- Scheine mit Ergebnis, für Statistik und «wer hat gewonnen».
create or replace view public.lotto_results with (security_invoker = true) as
  select t.id, t.day, t.name, t.nums, t.lucky,
    (select count(*) from unnest(t.nums) x where x = any (d.nums))::int as hits,
    t.lucky = d.lucky as star
  from public.lotto_tickets t join public.lotto_draws d using (day);
grant select on public.lotto_results to anon, authenticated;
