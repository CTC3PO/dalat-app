-- ============================================
-- RECURRING EVENTS SYSTEM
-- Migration: 20260126_001_recurring_events
-- ============================================

-- ===========================================
-- 1. EVENT SERIES TABLE
-- ===========================================
-- The "template" for recurring events with RRULE definition

CREATE TABLE event_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  -- Template data (shared by all instances)
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  location_name TEXT,
  address TEXT,
  google_maps_url TEXT,
  external_chat_url TEXT,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  capacity INT CHECK (capacity IS NULL OR capacity > 0),

  -- Ownership
  tribe_id UUID REFERENCES tribes ON DELETE SET NULL,
  organizer_id UUID REFERENCES organizers ON DELETE SET NULL,
  created_by UUID REFERENCES profiles ON DELETE CASCADE NOT NULL,

  -- Recurrence definition (RFC 5545 RRULE format)
  -- Examples:
  --   "FREQ=WEEKLY;BYDAY=TU" (every Tuesday)
  --   "FREQ=MONTHLY;BYDAY=2TU" (2nd Tuesday of month)
  --   "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA" (every other Saturday)
  rrule TEXT NOT NULL,

  -- Timing pattern (time only, date comes from rrule expansion)
  starts_at_time TIME NOT NULL,  -- e.g., '19:00:00'
  duration_minutes INT DEFAULT 120 CHECK (duration_minutes > 0),

  -- First occurrence date (needed for RRULE expansion start point)
  first_occurrence DATE NOT NULL,

  -- End conditions (optional - if both null, series is infinite)
  rrule_until TIMESTAMPTZ,  -- until specific date (inclusive)
  rrule_count INT CHECK (rrule_count IS NULL OR rrule_count > 0),  -- after N occurrences

  -- Series status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),

  -- Generation tracking (how far ahead we've materialized instances)
  instances_generated_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for event_series
CREATE INDEX idx_series_slug ON event_series(slug);
CREATE INDEX idx_series_status ON event_series(status) WHERE status = 'active';
CREATE INDEX idx_series_created_by ON event_series(created_by);
CREATE INDEX idx_series_organizer ON event_series(organizer_id) WHERE organizer_id IS NOT NULL;
CREATE INDEX idx_series_tribe ON event_series(tribe_id) WHERE tribe_id IS NOT NULL;

-- ===========================================
-- 2. EXTEND EVENTS TABLE
-- ===========================================
-- Add columns to link events to their series

ALTER TABLE events
  ADD COLUMN series_id UUID REFERENCES event_series ON DELETE SET NULL,
  ADD COLUMN series_instance_date DATE,  -- which occurrence this represents (e.g., '2025-01-14')
  ADD COLUMN is_exception BOOLEAN DEFAULT false,  -- was this instance modified from series template?
  ADD COLUMN exception_type TEXT CHECK (exception_type IN ('modified', 'cancelled', 'rescheduled'));

-- Indexes for series relationship
CREATE INDEX idx_events_series ON events(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX idx_events_series_date ON events(series_id, series_instance_date) WHERE series_id IS NOT NULL;

-- ===========================================
-- 3. SERIES EXCEPTIONS TABLE
-- ===========================================
-- Track cancelled/rescheduled instances that should be skipped during generation

CREATE TABLE series_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES event_series ON DELETE CASCADE NOT NULL,
  original_date DATE NOT NULL,  -- the date that was supposed to occur
  exception_type TEXT NOT NULL CHECK (exception_type IN ('cancelled', 'rescheduled')),
  new_event_id UUID REFERENCES events ON DELETE SET NULL,  -- if rescheduled, points to the new instance
  reason TEXT,  -- optional reason for cancellation
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles ON DELETE SET NULL NOT NULL,
  UNIQUE (series_id, original_date)
);

CREATE INDEX idx_exceptions_series ON series_exceptions(series_id);

-- ===========================================
-- 4. SERIES RSVPS TABLE
-- ===========================================
-- Track users who want to auto-RSVP to all future instances

CREATE TABLE series_rsvps (
  series_id UUID REFERENCES event_series ON DELETE CASCADE,
  user_id UUID REFERENCES profiles ON DELETE CASCADE,
  auto_rsvp BOOLEAN DEFAULT true,  -- automatically RSVP to new instances
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (series_id, user_id)
);

CREATE INDEX idx_series_rsvps_user ON series_rsvps(user_id);

-- ===========================================
-- 5. AUTO-RSVP TRIGGER
-- ===========================================
-- When a new event instance is created for a series,
-- auto-create RSVPs for users subscribed to the series

CREATE OR REPLACE FUNCTION auto_rsvp_for_series_subscribers()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if this event belongs to a series
  IF NEW.series_id IS NOT NULL THEN
    -- Create RSVPs for all series subscribers
    INSERT INTO rsvps (event_id, user_id, status, plus_ones)
    SELECT NEW.id, sr.user_id, 'going', 0
    FROM series_rsvps sr
    WHERE sr.series_id = NEW.series_id
      AND sr.auto_rsvp = true
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_series_event_created
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.series_id IS NOT NULL)
  EXECUTE FUNCTION auto_rsvp_for_series_subscribers();

-- ===========================================
-- 6. UPDATED_AT TRIGGER FOR SERIES
-- ===========================================

CREATE TRIGGER update_event_series_updated_at
  BEFORE UPDATE ON event_series
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- 7. RLS POLICIES FOR EVENT_SERIES
-- ===========================================

ALTER TABLE event_series ENABLE ROW LEVEL SECURITY;

-- Anyone can view active series
CREATE POLICY "Active series are viewable by everyone"
  ON event_series FOR SELECT
  USING (status = 'active');

-- Creators can view their own series (any status)
CREATE POLICY "Creators can view own series"
  ON event_series FOR SELECT
  USING (auth.uid() = created_by);

-- Only creators can create series
CREATE POLICY "Authenticated users can create series"
  ON event_series FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only creators can update their series
CREATE POLICY "Creators can update own series"
  ON event_series FOR UPDATE
  USING (auth.uid() = created_by);

-- Only creators can delete their series
CREATE POLICY "Creators can delete own series"
  ON event_series FOR DELETE
  USING (auth.uid() = created_by);

-- ===========================================
-- 8. RLS POLICIES FOR SERIES_EXCEPTIONS
-- ===========================================

ALTER TABLE series_exceptions ENABLE ROW LEVEL SECURITY;

-- Anyone can view exceptions (needed to show cancelled dates)
CREATE POLICY "Exceptions are viewable by everyone"
  ON series_exceptions FOR SELECT
  USING (true);

-- Only series creators can create exceptions
CREATE POLICY "Series creators can create exceptions"
  ON series_exceptions FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT created_by FROM event_series WHERE id = series_id)
  );

-- Only series creators can update exceptions
CREATE POLICY "Series creators can update exceptions"
  ON series_exceptions FOR UPDATE
  USING (
    auth.uid() = (SELECT created_by FROM event_series WHERE id = series_id)
  );

-- Only series creators can delete exceptions
CREATE POLICY "Series creators can delete exceptions"
  ON series_exceptions FOR DELETE
  USING (
    auth.uid() = (SELECT created_by FROM event_series WHERE id = series_id)
  );

-- ===========================================
-- 9. RLS POLICIES FOR SERIES_RSVPS
-- ===========================================

ALTER TABLE series_rsvps ENABLE ROW LEVEL SECURITY;

-- Anyone can see who's subscribed to a series
CREATE POLICY "Series RSVPs are viewable by everyone"
  ON series_rsvps FOR SELECT
  USING (true);

-- Users can create their own series RSVPs
CREATE POLICY "Users can create own series RSVPs"
  ON series_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own series RSVPs
CREATE POLICY "Users can update own series RSVPs"
  ON series_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own series RSVPs
CREATE POLICY "Users can delete own series RSVPs"
  ON series_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- ===========================================
-- 10. HELPER RPC FUNCTIONS
-- ===========================================

-- Get series by slug with creator profile
CREATE OR REPLACE FUNCTION get_series_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  location_name TEXT,
  address TEXT,
  google_maps_url TEXT,
  external_chat_url TEXT,
  timezone TEXT,
  capacity INT,
  tribe_id UUID,
  organizer_id UUID,
  created_by UUID,
  rrule TEXT,
  starts_at_time TIME,
  duration_minutes INT,
  first_occurrence DATE,
  rrule_until TIMESTAMPTZ,
  rrule_count INT,
  status TEXT,
  instances_generated_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  creator_display_name TEXT,
  creator_avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.slug,
    s.title,
    s.description,
    s.image_url,
    s.location_name,
    s.address,
    s.google_maps_url,
    s.external_chat_url,
    s.timezone,
    s.capacity,
    s.tribe_id,
    s.organizer_id,
    s.created_by,
    s.rrule,
    s.starts_at_time,
    s.duration_minutes,
    s.first_occurrence,
    s.rrule_until,
    s.rrule_count,
    s.status,
    s.instances_generated_until,
    s.created_at,
    s.updated_at,
    p.display_name AS creator_display_name,
    p.avatar_url AS creator_avatar_url
  FROM event_series s
  LEFT JOIN profiles p ON s.created_by = p.id
  WHERE s.slug = p_slug;
$$;

-- Get upcoming instances for a series
CREATE OR REPLACE FUNCTION get_series_upcoming_events(
  p_series_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS SETOF events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM events e
  WHERE e.series_id = p_series_id
    AND e.status = 'published'
    AND e.starts_at > now()
  ORDER BY e.starts_at ASC
  LIMIT p_limit;
$$;

-- Get exception dates for a series (for calendar display)
CREATE OR REPLACE FUNCTION get_series_exceptions(p_series_id UUID)
RETURNS TABLE (
  original_date DATE,
  exception_type TEXT,
  reason TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    original_date,
    exception_type,
    reason
  FROM series_exceptions
  WHERE series_id = p_series_id
  ORDER BY original_date;
$$;

-- Check if user is subscribed to series
CREATE OR REPLACE FUNCTION is_subscribed_to_series(
  p_series_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM series_rsvps
    WHERE series_id = p_series_id
      AND user_id = p_user_id
      AND auto_rsvp = true
  );
$$;

-- Subscribe to series (RSVP all future)
CREATE OR REPLACE FUNCTION subscribe_to_series(
  p_series_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert series subscription
  INSERT INTO series_rsvps (series_id, user_id, auto_rsvp)
  VALUES (p_series_id, p_user_id, true)
  ON CONFLICT (series_id, user_id)
  DO UPDATE SET auto_rsvp = true;

  -- Also RSVP to all existing future instances
  INSERT INTO rsvps (event_id, user_id, status, plus_ones)
  SELECT e.id, p_user_id, 'going', 0
  FROM events e
  WHERE e.series_id = p_series_id
    AND e.status = 'published'
    AND e.starts_at > now()
  ON CONFLICT (event_id, user_id) DO NOTHING;
END;
$$;

-- Unsubscribe from series
CREATE OR REPLACE FUNCTION unsubscribe_from_series(
  p_series_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove series subscription
  DELETE FROM series_rsvps
  WHERE series_id = p_series_id AND user_id = p_user_id;

  -- Note: We don't automatically cancel existing RSVPs
  -- User can cancel them individually if they want
END;
$$;
