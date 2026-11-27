-- Mobile Piston: Public multiplayer room directory (metadata only; gameplay stays P2P via PeerJS)

create table if not exists public.rooms (
  room_code text primary key,
  host_name text not null,
  track_id text not null,
  total_laps smallint not null default 3,
  player_count smallint not null default 1,
  max_players smallint not null default 8,
  status text not null default 'lobby',
  updated_at timestamptz not null default now(),
  constraint rooms_code_format check (room_code ~ '^[A-Z0-9]{4,8}$'),
  constraint rooms_laps_valid check (total_laps in (3, 4, 5)),
  constraint rooms_status_valid check (status in ('lobby', 'countdown', 'racing', 'finished'))
);

create index if not exists rooms_updated_at_idx on public.rooms (updated_at desc);

alter table public.rooms enable row level security;

drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all"
  on public.rooms for select
  to anon, authenticated
  using (true);

drop policy if exists "rooms_insert_all" on public.rooms;
create policy "rooms_insert_all"
  on public.rooms for insert
  to anon, authenticated
  with check (true);

drop policy if exists "rooms_update_all" on public.rooms;
create policy "rooms_update_all"
  on public.rooms for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "rooms_delete_all" on public.rooms;
create policy "rooms_delete_all"
  on public.rooms for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on table public.rooms to anon, authenticated;
