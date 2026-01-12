-- Moments Moderation RPC Functions
-- Provides approve, reject, and remove functionality for event creators

-- ============================================
-- RPC FUNCTIONS FOR MODERATION
-- ============================================

-- Get pending moments for an event (for moderation queue)
CREATE OR REPLACE FUNCTION get_pending_moments(
  p_event_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_id uuid,
  content_type text,
  media_url text,
  text_content text,
  status text,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow event creators to see pending moments
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = p_event_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_event_creator';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.event_id,
    m.user_id,
    m.content_type,
    m.media_url,
    m.text_content,
    m.status,
    m.created_at,
    p.username,
    p.display_name,
    p.avatar_url
  FROM moments m
  JOIN profiles p ON p.id = m.user_id
  WHERE m.event_id = p_event_id
    AND m.status = 'pending'
  ORDER BY m.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_moments(uuid, int, int) TO authenticated;

-- Approve a pending moment (set status to 'published')
CREATE OR REPLACE FUNCTION approve_moment(p_moment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_current_status text;
BEGIN
  -- Get the moment's event_id and current status
  SELECT event_id, status INTO v_event_id, v_current_status
  FROM moments
  WHERE id = p_moment_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'moment_not_found';
  END IF;

  -- Check if user is event creator
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = v_event_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_event_creator';
  END IF;

  -- Only pending moments can be approved
  IF v_current_status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Update the status
  UPDATE moments
  SET status = 'published', updated_at = now()
  WHERE id = p_moment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'moment_id', p_moment_id,
    'new_status', 'published'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_moment(uuid) TO authenticated;

-- Reject a pending moment (set status to 'rejected' with optional reason)
CREATE OR REPLACE FUNCTION reject_moment(
  p_moment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_current_status text;
BEGIN
  -- Get the moment's event_id and current status
  SELECT event_id, status INTO v_event_id, v_current_status
  FROM moments
  WHERE id = p_moment_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'moment_not_found';
  END IF;

  -- Check if user is event creator
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = v_event_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_event_creator';
  END IF;

  -- Only pending moments can be rejected
  IF v_current_status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Update the status with optional reason
  UPDATE moments
  SET
    status = 'rejected',
    moderation_note = p_reason,
    updated_at = now()
  WHERE id = p_moment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'moment_id', p_moment_id,
    'new_status', 'rejected'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_moment(uuid, text) TO authenticated;

-- Remove a published moment (set status to 'removed' with optional reason)
CREATE OR REPLACE FUNCTION remove_moment(
  p_moment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_current_status text;
BEGIN
  -- Get the moment's event_id and current status
  SELECT event_id, status INTO v_event_id, v_current_status
  FROM moments
  WHERE id = p_moment_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'moment_not_found';
  END IF;

  -- Check if user is event creator
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = v_event_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_event_creator';
  END IF;

  -- Can remove published or pending moments
  IF v_current_status NOT IN ('published', 'pending') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- Update the status with optional reason
  UPDATE moments
  SET
    status = 'removed',
    moderation_note = p_reason,
    updated_at = now()
  WHERE id = p_moment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'moment_id', p_moment_id,
    'new_status', 'removed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION remove_moment(uuid, text) TO authenticated;
