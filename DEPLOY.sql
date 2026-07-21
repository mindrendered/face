-- ═══════════════════════════════════════════════════════════════════════════
-- FACELESS PLATFORM — COMPLETE DEPLOYMENT SQL
-- Copy-paste this entire file into Supabase SQL Editor and run it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ADMIN PRIVILEGE ESCALATION FIX (00005)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION protect_admin_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot modify is_admin column directly.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER protect_profiles_admin_column
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_admin_column();
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION toggle_user_admin(target_user_id uuid, new_admin_status boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can change admin status';
  END IF;
  UPDATE profiles SET is_admin = new_admin_status WHERE id = target_user_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. COMPOSITE INDEXES (00006)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_videos_user_status ON videos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_series_user_status ON series(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_status ON scheduled_posts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_series_scheduled ON scheduled_posts(series_id, scheduled_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. FACEBOOK + SESSION COLUMNS (00007)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE social_credentials DROP CONSTRAINT IF EXISTS social_credentials_platform_check;
ALTER TABLE social_credentials ADD CONSTRAINT social_credentials_platform_check
  CHECK (platform IN ('instagram', 'youtube', 'facebook'));

ALTER TABLE social_connections DROP CONSTRAINT IF EXISTS social_connections_platform_check;
ALTER TABLE social_connections ADD CONSTRAINT social_connections_platform_check
  CHECK (platform IN ('instagram', 'youtube', 'facebook'));

ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS session_cookies jsonb;
ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS login_status text NOT NULL DEFAULT 'active'
  CHECK (login_status IN ('active', 'expired', 'challenge_required', 'locked', 'invalid_credentials'));

CREATE INDEX IF NOT EXISTS idx_social_credentials_platform ON social_credentials(user_id, platform);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SUPERADMIN + PLATFORM SETTINGS (00008)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO platform_settings (key, value, description) VALUES
  ('ai_script_model', '"gemini-2.5-flash"', 'LLM model for script generation'),
  ('ai_script_max_tokens', '1024', 'Max tokens for script generation'),
  ('ai_video_provider', '"kling"', 'Video generation provider'),
  ('ai_video_max_duration', '10', 'Max video duration in seconds'),
  ('ai_image_provider', '"appmedo"', 'Image generation provider'),
  ('auto_post_enabled', 'true', 'Enable auto-posting system-wide'),
  ('post_retry_max', '3', 'Max retries for failed posts'),
  ('post_retry_delay_minutes', '15', 'Minutes between retry attempts'),
  ('posting_window_start', '"06:00"', 'Earliest posting time (UTC)'),
  ('posting_window_end', '"23:00"', 'Latest posting time (UTC)'),
  ('content_moderation_enabled', 'true', 'Enable content moderation before posting'),
  ('max_script_length', '500', 'Max characters for generated scripts'),
  ('blocked_niches', '[]', 'Niches blocked from generation'),
  ('max_series_per_user_beginner', '2', 'Max series for beginner plan'),
  ('max_series_per_user_daily', '5', 'Max series for daily plan'),
  ('max_series_per_user_pro', '20', 'Max series for pro plan'),
  ('email_notifications_enabled', 'true', 'Send email notifications'),
  ('notify_on_video_ready', 'true', 'Notify when video generation completes'),
  ('notify_on_post_fail', 'true', 'Notify when posting fails'),
  ('notify_on_plan_limit', 'true', 'Notify when user hits plan limits'),
  ('platform_name', '"Faceless"', 'Platform display name'),
  ('platform_tagline', '"AI-Powered Faceless Content Automation"', 'Platform tagline'),
  ('support_email', '"support@faceless.app"', 'Support contact email'),
  ('analytics_retention_days', '90', 'Days to keep analytics data'),
  ('demo_data_enabled', 'true', 'Seed demo analytics for new users')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION is_superadmin(user_email text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE email = user_email AND is_admin = true);
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. PAYMENT GATEWAY + UPI SETTINGS (00009)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('beginner', 'daily', 'pro')),
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  method text NOT NULL CHECK (method IN ('upi', 'card', 'netbanking', 'wallet', 'manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'expired')),
  transaction_id text,
  upi_id text,
  upi_transaction_ref text,
  payment_gateway text DEFAULT 'manual',
  metadata jsonb DEFAULT '{}',
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own" ON payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "payments_insert_own" ON payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

INSERT INTO platform_settings (key, value, description) VALUES
  ('payment_upi_enabled', 'true', 'Enable UPI payments'),
  ('payment_upi_id', '"berinjohn@upi"', 'Primary UPI ID for receiving payments'),
  ('payment_upi_name', '"Faceless Platform"', 'Name shown on UPI payment screen'),
  ('payment_upi_qr_enabled', 'true', 'Show QR code for UPI payments'),
  ('payment_upi_merchant_code', '""', 'UPI merchant code (optional)'),
  ('payment_enabled', 'true', 'Master switch for all payments'),
  ('payment_currency', '"INR"', 'Default payment currency'),
  ('payment_currency_symbol', '"₹"', 'Currency symbol for display'),
  ('payment_gateway', '"manual"', 'Active payment gateway (manual, razorpay, stripe, cashfree)'),
  ('payment_razorpay_enabled', 'false', 'Enable Razorpay gateway'),
  ('payment_razorpay_key_id', '""', 'Razorpay Key ID'),
  ('payment_razorpay_key_secret', '""', 'Razorpay Key Secret'),
  ('payment_stripe_enabled', 'false', 'Enable Stripe gateway'),
  ('payment_stripe_publishable_key', '""', 'Stripe Publishable Key'),
  ('payment_stripe_secret_key', '""', 'Stripe Secret Key'),
  ('payment_cashfree_enabled', 'false', 'Enable Cashfree gateway'),
  ('payment_cashfree_app_id', '""', 'Cashfree App ID'),
  ('payment_cashfree_secret_key', '""', 'Cashfree Secret Key'),
  ('payment_expiry_minutes', '30', 'Payment link/expiry time in minutes'),
  ('payment_retry_allowed', 'true', 'Allow retrying failed payments'),
  ('payment_auto_activate', 'true', 'Auto-activate plan after successful payment'),
  ('payment_receipt_enabled', 'true', 'Generate payment receipts'),
  ('payment_success_redirect', '"/dashboard"', 'Redirect URL after successful payment'),
  ('payment_failed_redirect', '"/settings"', 'Redirect URL after failed payment'),
  ('subscription_expiry_enabled', 'true', 'Expire subscriptions at period end'),
  ('subscription_grace_period_days', '3', 'Grace period after subscription expiry'),
  ('subscription_auto_renew_reminder', 'true', 'Send reminder before renewal'),
  ('payment_gst_enabled', 'false', 'Apply GST on payments'),
  ('payment_gst_rate', '18', 'GST rate in percentage'),
  ('payment_gst_number', '""', 'GSTIN number'),
  ('payment_invoice_prefix', '"FVL-"', 'Invoice number prefix'),
  ('payment_invoice_start', '1001', 'Starting invoice number')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. SUPERADMIN PROMOTION (run AFTER creating the account)
-- ═══════════════════════════════════════════════════════════════════════════
-- Uncomment and run after creating berinjohn@gmail.com account:
-- UPDATE profiles SET is_admin = true WHERE email = 'berinjohn@gmail.com';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. AI PROVIDER REGISTRY (00014)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'mistral', 'ollama', 'custom')),
  api_key text,
  base_url text,
  models jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  use_for jsonb NOT NULL DEFAULT '["script","llm","image"]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_providers_select_own" ON ai_providers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ai_providers_insert_own" ON ai_providers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_providers_update_own" ON ai_providers FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ai_providers_delete_own" ON ai_providers FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER ai_providers_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_ai_providers_user_id ON ai_providers(user_id);
CREATE INDEX idx_ai_providers_provider ON ai_providers(provider);
CREATE INDEX idx_ai_providers_is_active ON ai_providers(is_active);

INSERT INTO platform_settings (key, value, description) VALUES
  ('ai_default_script_provider', '"gateway"', 'Default provider for script generation'),
  ('ai_default_llm_provider', '"gateway"', 'Default provider for general LLM calls'),
  ('ai_default_image_provider', '"gateway"', 'Default provider for image generation'),
  ('ai_gateway_url', '"https://gateway.appmedo.com"', 'Gateway URL for AI model proxy'),
  ('ai_gateway_key', '""', 'Gateway API key'),
  ('ai_ollama_url', '"http://localhost:11434"', 'Ollama server URL for local models')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. SKILLS AI INTEGRATION (00015)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE skills ADD COLUMN IF NOT EXISTS ai_provider_id uuid REFERENCES ai_providers(id) ON DELETE SET NULL;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS system_prompt text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS model_override text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS temperature numeric(3,2) DEFAULT 0.7;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS max_tokens int DEFAULT 1024;

ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_type_check;
ALTER TABLE skills ADD CONSTRAINT skills_type_check
  CHECK (type IN ('template', 'prompt_pack', 'style', 'niche', 'ai_prompt', 'voice_style', 'brand_kit'));

UPDATE skills SET
  system_prompt = 'You are a viral horror story narrator. Write in a suspenseful, atmospheric tone.',
  temperature = 0.8, max_tokens = 1500
WHERE name = 'Spooky Stories Starter';

UPDATE skills SET
  system_prompt = 'You are a motivational speaker who creates viral short-form content.',
  temperature = 0.7, max_tokens = 1200
WHERE name = 'Motivational Pack';

UPDATE skills SET
  system_prompt = 'You are a tech expert who explains complex concepts in simple, engaging ways.',
  temperature = 0.6, max_tokens = 1000
WHERE name = 'Tech Tips Quick';

INSERT INTO skills (user_id, name, description, type, content, system_prompt, temperature, max_tokens, is_public) VALUES
  ((SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
   'Viral Hooks Master', 'AI prompt skill for scroll-stopping hooks', 'ai_prompt',
   '{"niche": "general", "language": "English", "visual_style": "cinematic"}',
   'You are the world''s best viral hook writer. Generate 5 scroll-stopping opening hooks.',
   0.9, 500, true),
  ((SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
   'Storyteller Pro', 'AI prompt skill for narrative-driven content', 'ai_prompt',
   '{"niche": "storytelling", "language": "English", "visual_style": "cinematic"}',
   'You are a master storyteller who creates viral short-form narratives.',
   0.8, 1500, true),
  ((SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
   'Brand Voice Kit', 'Consistent brand voice configuration', 'brand_kit',
   '{"brand_name": "My Brand", "tone": "professional yet approachable", "values": ["innovation", "authenticity"]}',
   NULL, 0.7, 1024, true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. SERIES SKILL ID (00016)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE series ADD COLUMN IF NOT EXISTS skill_id uuid REFERENCES skills(id) ON DELETE SET NULL;
CREATE INDEX idx_series_skill_id ON series(skill_id) WHERE skill_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. AI USAGE TRACKING (00017)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES ai_providers(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  use_case text NOT NULL CHECK (use_case IN ('script', 'llm', 'image', 'video')),
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  latency_ms int DEFAULT 0,
  cost_estimate numeric(10,6) DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_select_own" ON ai_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_provider ON ai_usage(provider);
CREATE INDEX idx_ai_usage_use_case ON ai_usage(use_case);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);

INSERT INTO platform_settings (key, value, description) VALUES
  ('ai_cost_openai_input_per_1k', '0.0025', 'Cost per 1K input tokens for OpenAI GPT-4o'),
  ('ai_cost_openai_output_per_1k', '0.01', 'Cost per 1K output tokens for OpenAI GPT-4o'),
  ('ai_cost_anthropic_input_per_1k', '0.003', 'Cost per 1K input tokens for Anthropic Claude'),
  ('ai_cost_anthropic_output_per_1k', '0.015', 'Cost per 1K output tokens for Anthropic Claude'),
  ('ai_cost_google_input_per_1k', '0.000125', 'Cost per 1K input tokens for Google Gemini'),
  ('ai_cost_google_output_per_1k', '0.000375', 'Cost per 1K output tokens for Google Gemini'),
  ('ai_cost_mistral_input_per_1k', '0.002', 'Cost per 1K input tokens for Mistral'),
  ('ai_cost_mistral_output_per_1k', '0.006', 'Cost per 1K output tokens for Mistral')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;
