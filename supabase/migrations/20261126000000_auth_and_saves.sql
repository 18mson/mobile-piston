-- Mobile Piston: Supabase Auth (username + password) & cloud save migration

-- 1. Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- 2. Game saves table
create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint game_saves_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint game_saves_data_max_bytes check (pg_column_size(data) <= 16384),
  constraint game_saves_data_shape check (
    (data ? 'version')
    and (data ? 'selectedCarId')
    and (data ? 'selectedTrackId')
    and jsonb_typeof(data->'bestLapMs') = 'object'
  )
);

-- 3. Trigger: validate game_saves payload and keep updated_at fresh
create or replace function public.validate_game_save()
returns trigger
language plpgsql
as $$
begin
  if jsonb_typeof(new.data) <> 'object' then
    raise exception 'game_saves.data must be a JSON object';
  end if;
  if pg_column_size(new.data) > 16384 then
    raise exception 'game_saves.data exceeds 16KB limit';
  end if;
  if new.data ? 'unlocks' and jsonb_typeof(new.data->'unlocks') <> 'array' then
    raise exception 'game_saves.data.unlocks must be an array';
  end if;
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists trg_validate_game_save on public.game_saves;
create trigger trg_validate_game_save
  before insert or update on public.game_saves
  for each row execute function public.validate_game_save();

-- 4. Trigger: auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  clean_username text;
begin
  raw_username := coalesce(new.raw_user_meta_data->>'username', '');
  clean_username := lower(trim(raw_username));
  if clean_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username tidak valid (harus 3-20 karakter a-z, 0-9, _)';
  end if;

  insert into public.profiles (id, username)
  values (new.id, clean_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Row Level Security (RLS): own rows only, no client DELETE policy
alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "game_saves_select_own" on public.game_saves;
create policy "game_saves_select_own"
  on public.game_saves for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "game_saves_insert_own" on public.game_saves;
create policy "game_saves_insert_own"
  on public.game_saves for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "game_saves_update_own" on public.game_saves;
create policy "game_saves_update_own"
  on public.game_saves for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. RPC to check username availability without exposing profiles table
create or replace function public.is_username_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text;
begin
  clean := lower(trim(coalesce(candidate, '')));
  if clean !~ '^[a-z0-9_]{3,20}$' then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles where lower(username) = clean
  );
end;
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
