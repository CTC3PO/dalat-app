-- Update role column comment to remove outdated AI extraction reference
COMMENT ON COLUMN profiles.role IS 'User role: user (default), contributor, organizer_pending, organizer_verified, moderator, admin (full access)';
