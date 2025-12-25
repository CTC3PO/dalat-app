-- Add username validation constraint
-- Username must be 3-20 characters, lowercase letters, numbers, and underscores only
ALTER TABLE profiles ADD CONSTRAINT valid_username
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
