-- Mobile Piston: Per-track leaderboard / player best lap records

create table if not exists public.track_records (
  track_id text not null,
  player_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  player_name text not null,
  car_id text not null,
  color_index smallint not null default 0,
  best_lap_ms integer not null,
  total_time_ms integer,
  laps smallint not null default 3,
  recorded_at timestamptz not null default now(),
  primary key (track_id, player_key),
  constraint track_records_track_valid check (
    track_id in ('teluk-sore', 'mata-air', 'lereng-kopi', 'pelabuhan', 'rimba-lumpur')
  ),
  constraint track_records_car_valid check (
    car_id in ('mcqueen', 'luigi', 'guido', 'sally', 'chick', 'mater', 'doc', 'cruz', 'francesco', 'storm')
  ),
  constraint track_records_color_valid check (color_index >= 0 and color_index <= 3),
  constraint track_records_best_lap_valid check (best_lap_ms >= 1000 and best_lap_ms <= 3600000),
  constraint track_records_total_time_valid check (
    total_time_ms is null or (total_time_ms >= 1000 and total_time_ms <= 10800000)
  ),
  constraint track_records_laps_valid check (laps in (3, 4, 5)),
  constraint track_records_player_name_valid check (char_length(trim(player_name)) between 1 and 24)
);

create index if not exists track_records_leaderboard_idx
  on public.track_records (track_id, best_lap_ms asc, recorded_at asc);

alter table public.track_records enable row level security;

drop policy if exists "track_records_select_all" on public.track_records;
create policy "track_records_select_all"
  on public.track_records for select
  to anon, authenticated
  using (true);

create or replace function public.submit_track_record(
  p_track_id text,
  p_player_name text,
  p_car_id text,
  p_color_index smallint,
  p_best_lap_ms integer,
  p_total_time_ms integer default null,
  p_laps smallint default 3
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_key text;
  v_name text;
begin
  if p_best_lap_ms is null or p_best_lap_ms < 1000 or p_best_lap_ms > 3600000 then
    return;
  end if;

  v_uid := auth.uid();
  if v_uid is not null then
    select '@' || username into v_name from public.profiles where id = v_uid;
    v_key := 'u:' || v_uid::text;
  end if;

  v_name := left(trim(coalesce(nullif(v_name, ''), p_player_name, 'Pembalap')), 24);
  if v_key is null then
    v_key := 'n:' || lower(v_name);
  end if;

  insert into public.track_records (
    track_id,
    player_key,
    user_id,
    player_name,
    car_id,
    color_index,
    best_lap_ms,
    total_time_ms,
    laps,
    recorded_at
  )
  values (
    p_track_id,
    v_key,
    v_uid,
    v_name,
    p_car_id,
    least(3, greatest(0, coalesce(p_color_index, 0))),
    p_best_lap_ms,
    p_total_time_ms,
    case when p_laps in (3, 4, 5) then p_laps else 3 end,
    now()
  )
  on conflict (track_id, player_key) do update
    set
      player_name = excluded.player_name,
      car_id = excluded.car_id,
      color_index = excluded.color_index,
      best_lap_ms = excluded.best_lap_ms,
      total_time_ms = excluded.total_time_ms,
      laps = excluded.laps,
      recorded_at = now()
    where excluded.best_lap_ms < public.track_records.best_lap_ms;
end;
$$;

revoke all on function public.submit_track_record(text, text, text, smallint, integer, integer, smallint) from public;
grant execute on function public.submit_track_record(text, text, text, smallint, integer, integer, smallint) to anon, authenticated;

grant select on table public.track_records to anon, authenticated;
