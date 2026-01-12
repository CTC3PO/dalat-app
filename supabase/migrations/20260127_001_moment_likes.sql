-- Moment Likes System
-- Allows users to like/heart moments

-- ============================================
-- TABLE
-- ============================================

CREATE TABLE moment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id uuid REFERENCES moments ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- Each user can only like a moment once
  UNIQUE(moment_id, user_id)
);

CREATE INDEX idx_moment_likes_moment ON moment_likes(moment_id);
CREATE INDEX idx_moment_likes_user ON moment_likes(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE moment_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can see likes (for count display)
CREATE POLICY "moment_likes_select_public"
ON moment_likes FOR SELECT USING (true);

-- Authenticated users can insert likes
CREATE POLICY "moment_likes_insert_authenticated"
ON moment_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes (unlike)
CREATE POLICY "moment_likes_delete_own"
ON moment_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Toggle like on a moment (like/unlike)
CREATE OR REPLACE FUNCTION toggle_moment_like(p_moment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_existing_like uuid;
  v_new_liked boolean;
  v_new_count int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check if moment exists and is published
  IF NOT EXISTS (
    SELECT 1 FROM moments WHERE id = p_moment_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'moment_not_found';
  END IF;

  -- Check if user already liked this moment
  SELECT id INTO v_existing_like
  FROM moment_likes
  WHERE moment_id = p_moment_id AND user_id = v_uid;

  IF v_existing_like IS NOT NULL THEN
    -- Unlike: remove the like
    DELETE FROM moment_likes WHERE id = v_existing_like;
    v_new_liked := false;
  ELSE
    -- Like: add a new like
    INSERT INTO moment_likes (moment_id, user_id)
    VALUES (p_moment_id, v_uid);
    v_new_liked := true;
  END IF;

  -- Get updated count
  SELECT count(*) INTO v_new_count
  FROM moment_likes
  WHERE moment_id = p_moment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'moment_id', p_moment_id,
    'liked', v_new_liked,
    'count', v_new_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_moment_like(uuid) TO authenticated;

-- Get like status and count for a moment
CREATE OR REPLACE FUNCTION get_moment_like_status(p_moment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_liked boolean;
  v_count int;
BEGIN
  v_uid := auth.uid();

  -- Get count
  SELECT count(*) INTO v_count
  FROM moment_likes
  WHERE moment_id = p_moment_id;

  -- Check if current user liked it
  IF v_uid IS NOT NULL THEN
    v_liked := EXISTS (
      SELECT 1 FROM moment_likes
      WHERE moment_id = p_moment_id AND user_id = v_uid
    );
  ELSE
    v_liked := false;
  END IF;

  RETURN jsonb_build_object(
    'moment_id', p_moment_id,
    'liked', v_liked,
    'count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_moment_like_status(uuid) TO anon, authenticated;

-- Get like counts for multiple moments at once (batch query for efficiency)
CREATE OR REPLACE FUNCTION get_moment_like_counts(p_moment_ids uuid[])
RETURNS TABLE (
  moment_id uuid,
  liked boolean,
  count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  RETURN QUERY
  SELECT
    m.id AS moment_id,
    CASE WHEN v_uid IS NOT NULL THEN
      EXISTS (
        SELECT 1 FROM moment_likes ml
        WHERE ml.moment_id = m.id AND ml.user_id = v_uid
      )
    ELSE false END AS liked,
    (SELECT count(*) FROM moment_likes ml WHERE ml.moment_id = m.id) AS count
  FROM unnest(p_moment_ids) AS m(id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_moment_like_counts(uuid[]) TO anon, authenticated;
