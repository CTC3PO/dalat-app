-- Event Sponsors
-- Sponsors are reusable entities that can be linked to multiple events

-- ============================================
-- Sponsors Table (master list)
-- ============================================

CREATE TABLE sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  created_by uuid REFERENCES profiles,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sponsors_name ON sponsors(name);
CREATE INDEX idx_sponsors_created_by ON sponsors(created_by);

-- ============================================
-- Event Sponsors Junction Table
-- ============================================

CREATE TABLE event_sponsors (
  event_id uuid NOT NULL REFERENCES events ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES sponsors ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, sponsor_id)
);

CREATE INDEX idx_event_sponsors_event ON event_sponsors(event_id);
CREATE INDEX idx_event_sponsors_sponsor ON event_sponsors(sponsor_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;

-- SPONSORS --

-- Anyone can view sponsors (they're public info)
CREATE POLICY "sponsors_select"
ON sponsors FOR SELECT
USING (true);

-- Authenticated users can create sponsors
CREATE POLICY "sponsors_insert"
ON sponsors FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Creators or admins can update
CREATE POLICY "sponsors_update"
ON sponsors FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_role('admin'))
WITH CHECK (created_by = auth.uid() OR has_role('admin'));

-- Only admins can delete sponsors (they may be linked to multiple events)
CREATE POLICY "sponsors_delete"
ON sponsors FOR DELETE
TO authenticated
USING (has_role('admin'));

-- EVENT_SPONSORS --

-- Anyone can view event sponsors
CREATE POLICY "event_sponsors_select"
ON event_sponsors FOR SELECT
USING (true);

-- Event creators can link sponsors to their events
CREATE POLICY "event_sponsors_insert"
ON event_sponsors FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_id
    AND created_by = auth.uid()
  )
  OR has_role('admin')
);

-- Event creators can update sort order
CREATE POLICY "event_sponsors_update"
ON event_sponsors FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_id
    AND created_by = auth.uid()
  )
  OR has_role('admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_id
    AND created_by = auth.uid()
  )
  OR has_role('admin')
);

-- Event creators can unlink sponsors from their events
CREATE POLICY "event_sponsors_delete"
ON event_sponsors FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE id = event_id
    AND created_by = auth.uid()
  )
  OR has_role('admin')
);

-- ============================================
-- STORAGE BUCKET for Sponsor Logos
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sponsor-logos',
  'sponsor-logos',
  true,
  5242880,  -- 5MB limit (logos should be small)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for sponsor-logos bucket

-- Authenticated users can upload sponsor logos
CREATE POLICY "Authenticated users can upload sponsor logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sponsor-logos');

-- Anyone can view sponsor logos
CREATE POLICY "Anyone can view sponsor logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sponsor-logos');

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update sponsor logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sponsor-logos');

-- Admins can delete sponsor logos
CREATE POLICY "Admins can delete sponsor logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sponsor-logos'
  AND has_role('admin')
);
