-- dalat.app initial schema
-- Tables, triggers, RLS policies, and RPC functions

-- ============================================
-- TABLES
-- ============================================

-- profiles (auto-created on signup via trigger)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_profiles_username ON profiles(username);

-- tribes (recurring event groups)
CREATE TABLE tribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  cover_image_url text,
  created_by uuid REFERENCES profiles NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_tribes_slug ON tribes(slug);

-- tribe_follows (simplified: just follow, no roles for MVP)
CREATE TABLE tribe_follows (
  tribe_id uuid REFERENCES tribes ON DELETE CASCADE,
  user_id uuid REFERENCES profiles ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (tribe_id, user_id)
);

-- events
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  tribe_id uuid REFERENCES tribes,
  title text NOT NULL,
  description text,
  image_url text,
  location_name text,
  google_maps_url text,
  external_chat_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text DEFAULT 'Asia/Ho_Chi_Minh',
  capacity int CHECK (capacity IS NULL OR capacity > 0),
  status text DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_by uuid REFERENCES profiles NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_events_status ON events(status) WHERE status = 'published';

-- rsvps
CREATE TABLE rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'going' CHECK (status IN ('going', 'waitlist', 'cancelled')),
  plus_ones int DEFAULT 0 CHECK (plus_ones >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_rsvps_event_status ON rsvps(event_id, status);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tribes_updated_at BEFORE UPDATE ON tribes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_public"
ON profiles FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
ON profiles FOR DELETE
USING (auth.uid() = id);

-- TRIBES
ALTER TABLE tribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tribes_select_public"
ON tribes FOR SELECT USING (true);

CREATE POLICY "tribes_insert_creator"
ON tribes FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tribes_update_creator"
ON tribes FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tribes_delete_creator"
ON tribes FOR DELETE
USING (auth.uid() = created_by);

-- TRIBE_FOLLOWS (owner-only read for privacy)
ALTER TABLE tribe_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tribe_follows_select_owner"
ON tribe_follows FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "tribe_follows_insert_owner"
ON tribe_follows FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tribe_follows_delete_owner"
ON tribe_follows FOR DELETE
USING (auth.uid() = user_id);

-- EVENTS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_published_or_owner"
ON events FOR SELECT
USING (status = 'published' OR auth.uid() = created_by);

CREATE POLICY "events_insert_owner"
ON events FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "events_update_owner"
ON events FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "events_delete_owner"
ON events FOR DELETE
USING (auth.uid() = created_by);

-- RSVPS (logged-in read only)
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsvps_select_authed"
ON rsvps FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "rsvps_insert_owner"
ON rsvps FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rsvps_update_owner"
ON rsvps FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rsvps_delete_owner"
ON rsvps FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Public-safe counts (works for anon)
CREATE OR REPLACE FUNCTION get_event_counts(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_going_count int;
  v_waitlist_count int;
  v_going_spots int;
BEGIN
  SELECT
    count(*) FILTER (WHERE status = 'going'),
    count(*) FILTER (WHERE status = 'waitlist'),
    coalesce(sum(1 + plus_ones) FILTER (WHERE status = 'going'), 0)
  INTO v_going_count, v_waitlist_count, v_going_spots
  FROM rsvps
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'going_count', v_going_count,
    'going_spots', v_going_spots,
    'waitlist_count', v_waitlist_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_counts(uuid) TO anon, authenticated;

-- RSVP to event (atomic, excludes caller from spot count)
CREATE OR REPLACE FUNCTION rsvp_event(p_event_id uuid, p_plus_ones int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_capacity int;
  v_status text;
  v_event_status text;
  v_spots_taken_excl_me int;
  v_rsvp_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_plus_ones < 0 THEN
    RAISE EXCEPTION 'invalid_plus_ones';
  END IF;

  -- Lock event row to serialize capacity decisions
  SELECT capacity, status
  INTO v_capacity, v_event_status
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF v_event_status <> 'published' THEN
    RAISE EXCEPTION 'event_not_published';
  END IF;

  -- Spots taken EXCLUDING caller (so +1 updates work correctly)
  SELECT coalesce(sum(1 + plus_ones), 0)
  INTO v_spots_taken_excl_me
  FROM rsvps
  WHERE event_id = p_event_id
    AND status = 'going'
    AND user_id <> v_uid;

  IF v_capacity IS NULL OR (v_spots_taken_excl_me + 1 + p_plus_ones) <= v_capacity THEN
    v_status := 'going';
  ELSE
    v_status := 'waitlist';
  END IF;

  INSERT INTO rsvps (event_id, user_id, status, plus_ones)
  VALUES (p_event_id, v_uid, v_status, p_plus_ones)
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = EXCLUDED.status,
        plus_ones = EXCLUDED.plus_ones
  RETURNING id INTO v_rsvp_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status,
    'rsvp_id', v_rsvp_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rsvp_event(uuid, int) TO authenticated;

-- Cancel RSVP + auto-promote (with row locking)
CREATE OR REPLACE FUNCTION cancel_rsvp(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_was_going boolean := false;
  v_promoted_user uuid;
  v_event_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Lock event row to serialize promotions
  SELECT status INTO v_event_status
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  -- Check if was going
  SELECT (status = 'going')
  INTO v_was_going
  FROM rsvps
  WHERE event_id = p_event_id AND user_id = v_uid;

  -- Cancel
  UPDATE rsvps
  SET status = 'cancelled'
  WHERE event_id = p_event_id AND user_id = v_uid;

  -- Promote next from waitlist if was going
  IF v_was_going THEN
    UPDATE rsvps
    SET status = 'going'
    WHERE id = (
      SELECT id
      FROM rsvps
      WHERE event_id = p_event_id AND status = 'waitlist'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING user_id INTO v_promoted_user;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'cancelled', true,
    'promoted_user', v_promoted_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_rsvp(uuid) TO authenticated;
