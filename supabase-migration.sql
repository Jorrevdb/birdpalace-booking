-- ============================================================
-- Bird Palace Booking – Supabase migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- It is safe to run multiple times (all statements are idempotent).
-- ============================================================

-- ── Workers ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  google_calendar_id TEXT NOT NULL DEFAULT '',
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bookings ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_date             DATE NOT NULL,
  tour_time             TEXT NOT NULL,
  total_people          INTEGER NOT NULL,
  children_count        INTEGER NOT NULL DEFAULT 0,
  penguin_feeding_count INTEGER NOT NULL DEFAULT 0,
  visitor_name          TEXT NOT NULL,
  visitor_email         TEXT NOT NULL,
  visitor_phone         TEXT NOT NULL,
  visitor_message       TEXT,               -- optional note from visitor (added later)
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | denied
  assigned_worker_id    UUID REFERENCES workers(id),
  worker_message        TEXT,
  calendar_event_id     TEXT,               -- Google Calendar event ID for sync
  edit_token            UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to existing tables (safe to run multiple times)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS visitor_message TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- ── Booking responses (per worker) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  worker_id      UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  respond_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  action         TEXT,               -- NULL | 'accept' | 'decline'
  message        TEXT,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Settings (key/value JSON store) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default site settings (only if not already present)
INSERT INTO settings (key, value)
VALUES (
  'site',
  '{"site_name":"Bird Palace Pelt","contact_email":"info@birdpalace.be","tour_duration_minutes":90,"tour_times":"11:00,13:00,15:00","primary_color":"#2d6a4f"}'
)
ON CONFLICT (key) DO NOTHING;

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- The app uses the service role key on the server, so RLS can stay disabled
-- for now. Enable and configure if you want extra protection.

ALTER TABLE workers          DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         DISABLE ROW LEVEL SECURITY;
ALTER TABLE booking_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings         DISABLE ROW LEVEL SECURITY;
