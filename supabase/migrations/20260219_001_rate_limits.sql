-- Rate limiting table for production-safe rate limiting across serverless instances
-- Replaces in-memory rate limiting which resets on cold starts

CREATE TABLE rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action)
);

CREATE INDEX idx_rate_limits_user_action ON rate_limits(user_id, action);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own rate limits
CREATE POLICY "rate_limits_select_own"
ON rate_limits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "rate_limits_insert_own"
ON rate_limits FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rate_limits_update_own"
ON rate_limits FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "rate_limits_delete_own"
ON rate_limits FOR DELETE
USING (auth.uid() = user_id);

-- Atomic rate limit check and increment
-- Returns: { allowed: boolean, remaining: int, reset_at: timestamptz }
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_action text,
  p_limit int DEFAULT 5,
  p_window_ms int DEFAULT 3600000  -- 1 hour in milliseconds
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_record rate_limits%ROWTYPE;
  v_window_interval interval;
  v_now timestamptz;
  v_reset_at timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'not_authenticated'
    );
  END IF;

  v_now := now();
  v_window_interval := (p_window_ms || ' milliseconds')::interval;

  -- Try to get existing record with lock
  SELECT * INTO v_record
  FROM rate_limits
  WHERE user_id = v_uid AND action = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First request, create new record
    INSERT INTO rate_limits (user_id, action, count, window_start)
    VALUES (v_uid, p_action, 1, v_now);

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - 1,
      'reset_at', v_now + v_window_interval
    );
  END IF;

  -- Check if window has expired
  IF v_now > v_record.window_start + v_window_interval THEN
    -- Reset window
    UPDATE rate_limits
    SET count = 1, window_start = v_now
    WHERE id = v_record.id;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - 1,
      'reset_at', v_now + v_window_interval
    );
  END IF;

  v_reset_at := v_record.window_start + v_window_interval;

  -- Check if limit exceeded
  IF v_record.count >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', v_reset_at
    );
  END IF;

  -- Increment counter
  UPDATE rate_limits
  SET count = count + 1
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_record.count - 1,
    'reset_at', v_reset_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(text, int, int) TO authenticated;

-- Cleanup job helper: removes expired rate limit records
-- Run via cron or periodic cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits(p_window_ms int DEFAULT 3600000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - (p_window_ms || ' milliseconds')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
