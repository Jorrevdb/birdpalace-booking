-- ============================================================
-- BIRD PALACE BOOKING – Supabase Database Schema
-- Run this in your Supabase SQL Editor (once)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- WORKERS
-- ─────────────────────────────────────────
create table workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  google_calendar_id text not null, -- e.g. worker@gmail.com
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────
create table bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Slot
  tour_date date not null,
  tour_time text not null,       -- '11:00', '13:00', '15:00'

  -- Group info
  total_people integer not null check (total_people >= 1),
  children_count integer not null default 0,
  penguin_feeding_count integer not null default 0,

  -- Visitor info
  visitor_name text not null,
  visitor_email text not null,
  visitor_phone text not null,

  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),

  -- Assigned worker (set when approved)
  worker_id uuid references workers(id),

  -- Message from worker to visitor
  worker_message text,

  -- Unique token so visitor can view/edit their booking via link
  edit_token text not null unique default encode(gen_random_bytes(24), 'hex')
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bookings_updated_at
  before update on bookings
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- BOOKING RESPONSES (per worker per booking)
-- ─────────────────────────────────────────
create table booking_responses (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  worker_id uuid not null references workers(id),
  response text not null default 'pending'
    check (response in ('pending', 'accepted', 'declined')),
  message text,
  -- Unique token embedded in the worker's email link
  response_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz default now(),

  unique(booking_id, worker_id)
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table workers enable row level security;
alter table bookings enable row level security;
alter table booking_responses enable row level security;

-- Workers table: only readable by service role (server-side only)
create policy "service role only" on workers
  using (false); -- blocked for anon; only supabaseAdmin bypasses RLS

-- Bookings: visitor can read their own booking via edit_token
create policy "visitor reads own booking" on bookings
  for select using (true); -- filtered in API; RLS keeps anon writes blocked

-- No direct client writes – all writes go through API routes with service role
create policy "no direct inserts" on bookings
  for insert with check (false);

-- Booking responses: no direct access
create policy "no direct access" on booking_responses
  using (false);

-- ─────────────────────────────────────────
-- SAMPLE DATA (optional, remove before production)
-- ─────────────────────────────────────────
-- insert into workers (name, email, google_calendar_id) values
--   ('Jan', 'jan@birdpalace.be', 'jan@gmail.com'),
--   ('Lena', 'lena@birdpalace.be', 'lena@gmail.com'),
--   ('Tom', 'tom@birdpalace.be', 'tom@gmail.com');
