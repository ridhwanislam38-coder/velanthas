-- ── VELANTHAS — Initial Schema ────────────────────────────────────────────
-- Run via Supabase dashboard or: supabase db push
-- RLS: players read/write OWN data only. Leaderboard: read-all, write-own.

-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── player_saves ──────────────────────────────────────────────────────────
create table if not exists player_saves (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade,
  region       text not null default 'ASHFIELDS',
  position_x   float not null default 60,
  position_y   float not null default 100,
  hp           int not null default 100,
  max_hp       int not null default 100,
  ap           int not null default 0,
  attributes   jsonb not null default '{}',
  pictos        text[] not null default '{}',
  equipment    jsonb not null default '{}',
  updated_at   timestamptz not null default now()
);

alter table player_saves enable row level security;

create policy "player_saves: own data only"
  on player_saves
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── quest_states ──────────────────────────────────────────────────────────
create table if not exists quest_states (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid references player_saves on delete cascade,
  quest_id     text not null,
  stage        int not null default 0,
  choices_made jsonb not null default '[]',
  unique (player_id, quest_id)
);

alter table quest_states enable row level security;

create policy "quest_states: own data only"
  on quest_states
  for all
  using (
    auth.uid() = (select user_id from player_saves where id = player_id)
  )
  with check (
    auth.uid() = (select user_id from player_saves where id = player_id)
  );

-- ── faction_rep ───────────────────────────────────────────────────────────
create table if not exists faction_rep (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid references player_saves on delete cascade,
  faction_id   text not null,
  rep_value    int not null default 0,
  unique (player_id, faction_id)
);

alter table faction_rep enable row level security;

create policy "faction_rep: own data only"
  on faction_rep
  for all
  using (
    auth.uid() = (select user_id from player_saves where id = player_id)
  )
  with check (
    auth.uid() = (select user_id from player_saves where id = player_id)
  );

-- ── boss_deaths ───────────────────────────────────────────────────────────
create table if not exists boss_deaths (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid references player_saves on delete cascade,
  boss_id      text not null,
  death_count  int not null default 0,
  unique (player_id, boss_id)
);

alter table boss_deaths enable row level security;

create policy "boss_deaths: own data only"
  on boss_deaths
  for all
  using (
    auth.uid() = (select user_id from player_saves where id = player_id)
  )
  with check (
    auth.uid() = (select user_id from player_saves where id = player_id)
  );

-- ── leaderboard ───────────────────────────────────────────────────────────
create table if not exists leaderboard (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users on delete cascade,
  player_name    text not null,
  total_damage   bigint not null default 0,
  max_combo      int not null default 0,
  boss_kills     int not null default 0,
  time_played_s  int not null default 0,
  created_at     timestamptz not null default now()
);

alter table leaderboard enable row level security;

-- Everyone can read leaderboard
create policy "leaderboard: read public"
  on leaderboard
  for select
  using (true);

-- Own row only for insert/update
create policy "leaderboard: write own"
  on leaderboard
  for insert
  with check (auth.uid() = user_id);

create policy "leaderboard: update own"
  on leaderboard
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Auto-update trigger ───────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger player_saves_updated_at
  before update on player_saves
  for each row execute function update_updated_at();

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Enable realtime for leaderboard only (avoid broadcasting save data)
alter publication supabase_realtime add table leaderboard;
