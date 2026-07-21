
-- Add 'facebook' to platform CHECK constraints

-- social_credentials: drop old constraint, add new one with facebook
ALTER TABLE social_credentials DROP CONSTRAINT IF EXISTS social_credentials_platform_check;
ALTER TABLE social_credentials ADD CONSTRAINT social_credentials_platform_check
  CHECK (platform IN ('instagram', 'youtube', 'facebook'));

-- social_connections: drop old constraint, add new one with facebook
ALTER TABLE social_connections DROP CONSTRAINT IF EXISTS social_connections_platform_check;
ALTER TABLE social_connections ADD CONSTRAINT social_connections_platform_check
  CHECK (platform IN ('instagram', 'youtube', 'facebook'));

-- Add session storage columns to social_credentials
ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS session_cookies jsonb;
ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS login_status text NOT NULL DEFAULT 'active'
  CHECK (login_status IN ('active', 'expired', 'challenge_required', 'locked', 'invalid_credentials'));

-- Index for faster lookups by platform
CREATE INDEX IF NOT EXISTS idx_social_credentials_platform ON social_credentials(user_id, platform);
