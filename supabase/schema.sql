-- ============================================================================
-- Eagle Puzzle - Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db execute -f schema.sql`).
-- Safe to re-run: everything is idempotent.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.game_status as enum ('WAITING', 'RUNNING', 'COMPLETED', 'RESETTING');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.piece_status as enum ('EMPTY', 'FILLED');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id               uuid primary key default gen_random_uuid(),
  status           public.game_status not null default 'WAITING',
  total_pieces     int  not null default 10 check (total_pieces between 1 and 64),
  completed_pieces int  not null default 0  check (completed_pieces >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.puzzle_pieces (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games(id) on delete cascade,
  piece_index       int  not null check (piece_index >= 1),
  demo_image_url    text,
  uploaded_image_url text,
  status            public.piece_status not null default 'EMPTY',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (game_id, piece_index)
);

create index if not exists puzzle_pieces_game_status_idx
  on public.puzzle_pieces (game_id, status, piece_index);

create table if not exists public.uploads (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  piece_index int  not null,
  image_url   text not null,
  client_ref  text,
  created_at  timestamptz not null default now()
);

-- Idempotency: the same submission (client_ref) is only ever stored once.
create unique index if not exists uploads_game_client_ref_key
  on public.uploads (game_id, client_ref)
  where client_ref is not null;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

drop trigger if exists puzzle_pieces_touch_updated_at on public.puzzle_pieces;
create trigger puzzle_pieces_touch_updated_at
  before update on public.puzzle_pieces
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic piece allocation
--
-- Locks the game row FOR UPDATE which serializes all concurrent uploads for
-- that game, then claims the lowest-index EMPTY piece. Two simultaneous
-- uploads can never claim the same piece.
-- Also idempotent per (game_id, client_ref).
-- ---------------------------------------------------------------------------
drop function if exists public.allocate_piece(uuid, text, text);

create or replace function public.allocate_piece(
  p_game_id    uuid,
  p_image_url  text,
  p_client_ref text default null
)
returns table (
  piece_index      int,
  game_id          uuid,
  image_url        text,
  completed_pieces int,
  total_pieces     int,
  status           public.game_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_piece_id      uuid;
  v_piece_index   int;
  v_total         int;
  v_completed     int;
  v_status        public.game_status;
  v_existing_idx  int;
  v_existing_url  text;
begin
  -- Serialize all allocations for this game first. This makes both the
  -- idempotency check and the piece claim race-free.
  select g.total_pieces, g.status, g.completed_pieces
    into v_total, v_status, v_completed
    from public.games g
    where g.id = p_game_id
    for update;

  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotency: replaying the same client_ref returns the original
  -- allocation (checked under the game lock, so it cannot race).
  if p_client_ref is not null then
    select u.piece_index, u.image_url
      into v_existing_idx, v_existing_url
      from public.uploads u
      where u.game_id = p_game_id and u.client_ref = p_client_ref
      limit 1;

    if v_existing_idx is not null then
      return query
        select v_existing_idx, p_game_id, v_existing_url, v_completed, v_total, v_status;
      return;
    end if;
  end if;

  if v_status = 'COMPLETED' then
    raise exception 'GAME_ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  -- Claim the next empty piece.
  select p.id, p.piece_index
    into v_piece_id, v_piece_index
    from public.puzzle_pieces p
    where p.game_id = p_game_id and p.status = 'EMPTY'
    order by p.piece_index
    limit 1
    for update skip locked;

  if v_piece_id is null then
    raise exception 'NO_EMPTY_PIECE' using errcode = 'P0001';
  end if;

  update public.puzzle_pieces p
    set uploaded_image_url = p_image_url,
        status             = 'FILLED',
        updated_at         = now()
    where p.id = v_piece_id;

  insert into public.uploads (game_id, piece_index, image_url, client_ref)
    values (p_game_id, v_piece_index, p_image_url, p_client_ref);

  update public.games g
    set completed_pieces = (
          select count(*) from public.puzzle_pieces pp
          where pp.game_id = p_game_id and pp.status = 'FILLED'
        ),
        status = case
                   when (
                     select count(*) from public.puzzle_pieces pp
                     where pp.game_id = p_game_id and pp.status = 'FILLED'
                   ) >= g.total_pieces
                   then 'COMPLETED'::public.game_status
                   else 'RUNNING'::public.game_status
                 end,
        updated_at = now()
    where g.id = p_game_id
    returning g.completed_pieces, g.status into v_completed, v_status;

  return query
    select v_piece_index, p_game_id, p_image_url, v_completed, v_total, v_status;
end $$;

-- ---------------------------------------------------------------------------
-- Create a new game + its pieces
-- ---------------------------------------------------------------------------
create or replace function public.new_game(
  p_total_pieces int default 10,
  p_demo_url     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  i int;
begin
  if p_total_pieces is null or p_total_pieces < 1 or p_total_pieces > 64 then
    raise exception 'INVALID_TOTAL_PIECES';
  end if;

  insert into public.games (status, total_pieces, completed_pieces)
    values ('RUNNING', p_total_pieces, 0)
    returning id into v_game_id;

  for i in 1..p_total_pieces loop
    insert into public.puzzle_pieces (game_id, piece_index, demo_image_url, status)
      values (v_game_id, i, p_demo_url, 'EMPTY');
  end loop;

  return v_game_id;
end $$;

-- ---------------------------------------------------------------------------
-- Reset a game back to the initial demo state
-- ---------------------------------------------------------------------------
create or replace function public.reset_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games
    set status = 'RESETTING', updated_at = now()
    where id = p_game_id;

  update public.puzzle_pieces
    set uploaded_image_url = null,
        status             = 'EMPTY',
        updated_at         = now()
    where game_id = p_game_id;

  update public.games
    set completed_pieces = 0,
        status           = 'RUNNING',
        updated_at       = now()
    where id = p_game_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.games          enable row level security;
alter table public.puzzle_pieces  enable row level security;
alter table public.uploads        enable row level security;

-- Public read-only for the LED screen / player (realtime needs SELECT).
drop policy if exists games_public_read on public.games;
create policy games_public_read on public.games
  for select to anon, authenticated using (true);

drop policy if exists puzzle_pieces_public_read on public.puzzle_pieces;
create policy puzzle_pieces_public_read on public.puzzle_pieces
  for select to anon, authenticated using (true);

-- uploads are only read server-side (service role); no public policy on purpose.

-- No INSERT/UPDATE/DELETE policies for anon/authenticated: all writes flow
-- through security-definer RPCs executed by the service role.

-- ---------------------------------------------------------------------------
-- Lock down the RPCs: only the server (service_role) may call them.
-- ---------------------------------------------------------------------------
revoke all on function public.allocate_piece(uuid, text, text) from public, anon, authenticated;
grant execute on function public.allocate_piece(uuid, text, text) to service_role;

revoke all on function public.new_game(int, text) from public, anon, authenticated;
grant execute on function public.new_game(int, text) to service_role;

revoke all on function public.reset_game(uuid) from public, anon, authenticated;
grant execute on function public.reset_game(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter table public.puzzle_pieces replica identity full;
alter table public.games         replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.games;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.puzzle_pieces;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('game-uploads', 'game-uploads', true)
  on conflict (id) do update set public = true;
