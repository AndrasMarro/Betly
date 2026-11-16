-- Betly: Spielstände pro Konto.
-- Im Supabase-Dashboard unter «SQL Editor» einfügen und «Run» drücken. Mehrfach ausführen schadet nicht.

-- Ein Eintrag pro Spielstand-Schlüssel (betly:wallet, betly:snake, betly:settings …), wie im localStorage.
create table if not exists public.saves (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null check (key ~ '^betly:[a-z0-9-]{1,32}$'),
  data text not null check (octet_length(data) <= 65536),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Jeder sieht und ändert nur die eigenen Zeilen. Gäste (anon) sehen nichts.
alter table public.saves enable row level security;
drop policy if exists "own saves" on public.saves;
create policy "own saves" on public.saves for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.saves from anon;
grant select on public.saves to anon; -- liefert Gästen nur [] (RLS), dient dem täglichen Keep-alive-Ping
grant select, insert, update, delete on public.saves to authenticated;

-- Server-Uhr für updated_at und Grundregeln fürs Guthaben.
create or replace function public.saves_check() returns trigger
language plpgsql set search_path = '' as $$
declare
  w jsonb;
  prev numeric;
begin
  new.updated_at := now();
  if new.key = 'betly:wallet' then
    w := new.data::jsonb;
    if coalesce(jsonb_typeof(w->'balance'), '') <> 'number'
       or coalesce(jsonb_typeof(w->'rounds'), '') <> 'number'
       or (w->>'balance')::numeric not between 0 and 100000000
       or (w->>'rounds')::numeric < 0 then
      raise exception 'invalid wallet';
    end if;
    -- Rundenzähler läuft nur vorwärts, ausser beim «Konto zurücksetzen» (10 000, 0 Runden)
    if tg_op = 'UPDATE' then
      prev := (old.data::jsonb->>'rounds')::numeric;
      if (w->>'rounds')::numeric < prev
         and not ((w->>'rounds')::numeric = 0 and (w->>'balance')::numeric = 10000) then
        raise exception 'rounds cannot go back';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists saves_check on public.saves;
create trigger saves_check before insert or update on public.saves
  for each row execute function public.saves_check();

-- «Konto löschen» in den Einstellungen: löscht das eigene Login, die Spielstände gehen per cascade mit.
create or replace function public.delete_me() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
