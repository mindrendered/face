
-- ═══════════════════════════════════════════════════════════════════════════
-- AI Provider Registry
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

-- Users can manage their own providers
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Default AI provider settings in platform_settings
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO platform_settings (key, value, description) VALUES
  ('ai_default_script_provider', '"gateway"', 'Default provider for script generation (gateway, openai, anthropic, google, mistral, ollama)'),
  ('ai_default_llm_provider', '"gateway"', 'Default provider for general LLM calls'),
  ('ai_default_image_provider', '"gateway"', 'Default provider for image generation'),
  ('ai_gateway_url', '"https://gateway.appmedo.com"', 'Gateway URL for AI model proxy'),
  ('ai_gateway_key', '""', 'Gateway API key'),
  ('ai_ollama_url', '"http://localhost:11434"', 'Ollama server URL for local models')

ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;
