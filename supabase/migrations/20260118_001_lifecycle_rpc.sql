-- Event lifecycle query helper
-- Returns events filtered by lifecycle state: upcoming, happening, past

CREATE OR REPLACE FUNCTION get_events_by_lifecycle(
  p_lifecycle text,  -- 'upcoming', 'happening', 'past'
  p_limit int DEFAULT 20
)
RETURNS SETOF events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM events
  WHERE status = 'published'
  AND CASE p_lifecycle
    -- Upcoming: starts in the future
    WHEN 'upcoming' THEN starts_at > now()

    -- Happening Now: started but not ended
    -- If ends_at is set, use it; otherwise assume 4 hour duration
    WHEN 'happening' THEN
      starts_at <= now()
      AND (
        ends_at >= now()
        OR (ends_at IS NULL AND starts_at + interval '4 hours' >= now())
      )

    -- Past: has ended
    -- If ends_at is set, use it; otherwise assume 4 hour duration
    WHEN 'past' THEN
      (ends_at IS NOT NULL AND ends_at < now())
      OR (ends_at IS NULL AND starts_at + interval '4 hours' < now())

    ELSE false
  END
  ORDER BY
    -- Past events: most recent first (descending)
    -- Upcoming/Happening: soonest first (ascending)
    CASE WHEN p_lifecycle = 'past' THEN NULL ELSE starts_at END ASC NULLS LAST,
    CASE WHEN p_lifecycle = 'past' THEN starts_at ELSE NULL END DESC NULLS LAST
  LIMIT p_limit;
$$;

-- Grant access to both anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_events_by_lifecycle(text, int) TO anon, authenticated;

COMMENT ON FUNCTION get_events_by_lifecycle IS
'Returns events filtered by lifecycle state.
- upcoming: events that haven''t started yet
- happening: events currently in progress (uses ends_at or 4hr default)
- past: events that have ended';
