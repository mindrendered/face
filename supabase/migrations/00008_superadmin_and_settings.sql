
-- Superadmin seed: berinjohn@gmail.com with full admin access
-- Password: Admin@6421 (must be created via Supabase Auth UI or signup flow, then promoted)
-- This migration adds the admin flag once the user exists.

-- Seed additional platform settings for the superadmin panel
INSERT INTO platform_settings (key, value, description) VALUES
  -- AI Gateway settings
  ('ai_script_model', '"gemini-2.5-flash"', 'LLM model for script generation'),
  ('ai_script_max_tokens', '1024', 'Max tokens for script generation'),
  ('ai_video_provider', '"kling"', 'Video generation provider'),
  ('ai_video_max_duration', '10', 'Max video duration in seconds'),
  ('ai_image_provider', '"appmedo"', 'Image generation provider'),

  -- Posting settings
  ('auto_post_enabled', 'true', 'Enable auto-posting system-wide'),
  ('post_retry_max', '3', 'Max retries for failed posts'),
  ('post_retry_delay_minutes', '15', 'Minutes between retry attempts'),
  ('posting_window_start', '"06:00"', 'Earliest posting time (UTC)'),
  ('posting_window_end', '"23:00"', 'Latest posting time (UTC)'),

  -- Content moderation
  ('content_moderation_enabled', 'true', 'Enable content moderation before posting'),
  ('max_script_length', '500', 'Max characters for generated scripts'),
  ('blocked_niches', '[]', 'Niches blocked from generation'),

  -- Platform limits
  ('max_series_per_user_beginner', '2', 'Max series for beginner plan'),
  ('max_series_per_user_daily', '5', 'Max series for daily plan'),
  ('max_series_per_user_pro', '20', 'Max series for pro plan'),

  -- Notification settings
  ('email_notifications_enabled', 'true', 'Send email notifications'),
  ('notify_on_video_ready', 'true', 'Notify when video generation completes'),
  ('notify_on_post_fail', 'true', 'Notify when posting fails'),
  ('notify_on_plan_limit', 'true', 'Notify when user hits plan limits'),

  -- Branding
  ('platform_name', '"Faceless"', 'Platform display name'),
  ('platform_tagline', '"AI-Powered Faceless Content Automation"', 'Platform tagline'),
  ('support_email', '"support@faceless.app"', 'Support contact email'),
  ('maintenance_mode', 'false', 'Enable maintenance mode'),

  -- Analytics
  ('analytics_retention_days', '90', 'Days to keep analytics data'),
  ('demo_data_enabled', 'true', 'Seed demo analytics for new users')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- Create a function to check if a user is superadmin (email-based)
CREATE OR REPLACE FUNCTION is_superadmin(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE email = user_email AND is_admin = true
  );
$$;
