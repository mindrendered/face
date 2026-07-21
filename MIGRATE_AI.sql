-- ═══════════════════════════════════════════════════════════════════════════
-- AI SYSTEM MIGRATION — Run this in Supabase SQL Editor
-- Covers: ai_providers, ai_usage, skills AI columns, series.skill_id
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. AI Providers table
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

DO $$ BEGIN
  CREATE POLICY "ai_providers_select_own" ON ai_providers FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ai_providers_insert_own" ON ai_providers FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ai_providers_update_own" ON ai_providers FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ai_providers_delete_own" ON ai_providers FOR DELETE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER ai_providers_updated_at
    BEFORE UPDATE ON ai_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_provider ON ai_providers(provider);
CREATE INDEX IF NOT EXISTS idx_ai_providers_is_active ON ai_providers(is_active);

-- 2. AI Usage tracking table
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

DO $$ BEGIN
  CREATE POLICY "ai_usage_select_own" ON ai_usage FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_use_case ON ai_usage(use_case);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at DESC);

-- 3. Skills AI columns
DO $$ BEGIN
  ALTER TABLE skills ADD COLUMN ai_provider_id uuid REFERENCES ai_providers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE skills ADD COLUMN system_prompt text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE skills ADD COLUMN model_override text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE skills ADD COLUMN temperature numeric(3,2) DEFAULT 0.7;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE skills ADD COLUMN max_tokens int DEFAULT 1024;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Extend skill type check
DO $$ BEGIN
  ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_type_check;
  ALTER TABLE skills ADD CONSTRAINT skills_type_check
    CHECK (type IN ('template', 'prompt_pack', 'style', 'niche', 'ai_prompt', 'voice_style', 'brand_kit'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4. Series skill_id
DO $$ BEGIN
  ALTER TABLE series ADD COLUMN skill_id uuid REFERENCES skills(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_series_skill_id ON series(skill_id) WHERE skill_id IS NOT NULL;

-- 5. Platform settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('ai_default_script_provider', '"gateway"', 'Default provider for script generation'),
  ('ai_default_llm_provider', '"gateway"', 'Default provider for general LLM calls'),
  ('ai_default_image_provider', '"gateway"', 'Default provider for image generation'),
  ('ai_gateway_url', '"https://gateway.appmedo.com"', 'Gateway URL for AI model proxy'),
  ('ai_gateway_key', '""', 'Gateway API key'),
  ('ai_ollama_url', '"http://localhost:11434"', 'Ollama server URL for local models'),
  ('ai_cost_openai_input_per_1k', '0.0025', 'Cost per 1K input tokens for OpenAI GPT-4o'),
  ('ai_cost_openai_output_per_1k', '0.01', 'Cost per 1K output tokens for OpenAI GPT-4o'),
  ('ai_cost_anthropic_input_per_1k', '0.003', 'Cost per 1K input tokens for Anthropic Claude'),
  ('ai_cost_anthropic_output_per_1k', '0.015', 'Cost per 1K output tokens for Anthropic Claude'),
  ('ai_cost_google_input_per_1k', '0.000125', 'Cost per 1K input tokens for Google Gemini'),
  ('ai_cost_google_output_per_1k', '0.000375', 'Cost per 1K output tokens for Google Gemini'),
  ('ai_cost_mistral_input_per_1k', '0.002', 'Cost per 1K input tokens for Mistral'),
  ('ai_cost_mistral_output_per_1k', '0.006', 'Cost per 1K output tokens for Mistral')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- 6. Update existing skills with AI configs
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

-- 7. Seed new AI skills (only if admin user exists)
DO $$ DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE is_admin = true LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO skills (user_id, name, description, type, content, system_prompt, temperature, max_tokens, is_public) VALUES
      (admin_id, 'Viral Hooks Master', 'AI prompt skill for scroll-stopping hooks', 'ai_prompt',
       '{"niche": "general", "language": "English", "visual_style": "cinematic"}',
       'You are the world''s best viral hook writer. Generate 5 scroll-stopping opening hooks.',
       0.9, 500, true),
      (admin_id, 'Storyteller Pro', 'AI prompt skill for narrative-driven content', 'ai_prompt',
       '{"niche": "storytelling", "language": "English", "visual_style": "cinematic"}',
       'You are a master storyteller who creates viral short-form narratives.',
       0.8, 1500, true),
      (admin_id, 'Brand Voice Kit', 'Consistent brand voice configuration', 'brand_kit',
       '{"brand_name": "My Brand", "tone": "professional yet approachable", "values": ["innovation", "authenticity"]}',
       NULL, 0.7, 1024, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
