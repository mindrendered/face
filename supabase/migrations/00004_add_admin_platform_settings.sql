
-- Add is_admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Platform settings table (managed by super admin)
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_read_all" ON platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_settings_admin_write" ON platform_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Seed default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('plans', '{"beginner":{"price":19,"videos_per_month":12,"frequency":"3x_week","label":"Beginner"},"daily":{"price":39,"videos_per_month":30,"frequency":"daily","label":"Daily"},"pro":{"price":79,"videos_per_month":60,"frequency":"pro","label":"Pro"}}', 'Pricing plans configuration'),
  ('max_series_per_plan', '{"beginner":2,"daily":5,"pro":20}', 'Max series allowed per plan'),
  ('video_generation_timeout', '180', 'Max seconds to wait for video generation'),
  ('supported_languages', '["English","Spanish","French","Portuguese","German","Italian","Dutch","Polish","Japanese","Korean"]', 'Supported narration languages'),
  ('maintenance_mode', 'false', 'Put platform in maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- Social connection credentials table (for OAuth tokens per user)
CREATE TABLE IF NOT EXISTS social_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'youtube')),
  app_id text,
  access_token text,
  refresh_token text,
  account_id text,
  account_name text,
  account_username text,
  token_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE social_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials_own" ON social_credentials FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER social_credentials_updated_at
  BEFORE UPDATE ON social_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
