-- Make RSVPs publicly readable (for event attendee lists)
-- Anyone can see who's going, but only the owner can modify their own RSVP

-- Drop the old authenticated-only policy
DROP POLICY IF EXISTS "rsvps_select_authed" ON rsvps;

-- Create new public read policy
CREATE POLICY "rsvps_select_public"
ON rsvps FOR SELECT
USING (true);
