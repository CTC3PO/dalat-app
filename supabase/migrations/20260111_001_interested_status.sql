-- Add "interested" RSVP status for low-commitment event interest
-- Interested users don't count toward capacity but receive reminders

-- 1. Update CHECK constraint on rsvps.status to include 'interested'
ALTER TABLE rsvps DROP CONSTRAINT IF EXISTS rsvps_status_check;
ALTER TABLE rsvps ADD CONSTRAINT rsvps_status_check
  CHECK (status IN ('going', 'waitlist', 'cancelled', 'interested'));

-- 2. Update get_event_counts() to return interested_count
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
  v_interested_count int;
BEGIN
  SELECT
    count(*) FILTER (WHERE status = 'going'),
    count(*) FILTER (WHERE status = 'waitlist'),
    coalesce(sum(1 + plus_ones) FILTER (WHERE status = 'going'), 0),
    count(*) FILTER (WHERE status = 'interested')
  INTO v_going_count, v_waitlist_count, v_going_spots, v_interested_count
  FROM rsvps
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'going_count', v_going_count,
    'going_spots', v_going_spots,
    'waitlist_count', v_waitlist_count,
    'interested_count', v_interested_count
  );
END;
$$;

-- 3. Create mark_interested() RPC function
-- Handles switching from going -> interested (promotes waitlist)
CREATE OR REPLACE FUNCTION mark_interested(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_event_status text;
  v_rsvp_id uuid;
  v_was_going boolean := false;
  v_promoted_user uuid;
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

  IF v_event_status <> 'published' THEN
    RAISE EXCEPTION 'event_not_published';
  END IF;

  -- Check if user was going (to trigger promotion)
  SELECT (status = 'going') INTO v_was_going
  FROM rsvps
  WHERE event_id = p_event_id AND user_id = v_uid;

  -- Upsert as interested (plus_ones = 0 since they're not taking spots)
  INSERT INTO rsvps (event_id, user_id, status, plus_ones)
  VALUES (p_event_id, v_uid, 'interested', 0)
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = 'interested',
        plus_ones = 0
  RETURNING id INTO v_rsvp_id;

  -- Promote next from waitlist if user was going
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
    'status', 'interested',
    'rsvp_id', v_rsvp_id,
    'promoted_user', v_promoted_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION mark_interested(uuid) TO authenticated;
