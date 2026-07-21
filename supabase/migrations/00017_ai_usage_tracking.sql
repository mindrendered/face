
-- ═══════════════════════════════════════════════════════════════════════════
-- AI Usage Tracking
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

-- Users can read their own usage
CREATE POLICY "ai_usage_select_own" ON ai_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role can insert (edge functions use service role)
-- No insert/update/delete policies for users — only service role writes

CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_provider ON ai_usage(provider);
CREATE INDEX idx_ai_usage_use_case ON ai_usage(use_case);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);
CREATE INDEX idx_ai_usage_user_date ON ai_usage(user_id, created_at DESC);

-- Auto-cleanup: partition by month for performance (optional, for large scale)
-- For now, just index efficiently

-- Seed platform_settings for cost tracking
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
