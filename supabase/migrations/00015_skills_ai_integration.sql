
-- ═══════════════════════════════════════════════════════════════════════════
-- Skills AI Integration
-- ═══════════════════════════════════════════════════════════════════════════

-- Add AI config columns to skills
ALTER TABLE skills ADD COLUMN IF NOT EXISTS ai_provider_id uuid REFERENCES ai_providers(id) ON DELETE SET NULL;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS system_prompt text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS model_override text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS temperature numeric(3,2) DEFAULT 0.7;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS max_tokens int DEFAULT 1024;

-- Extend skill type enum to include AI-focused types
-- (PostgreSQL CHECK constraint can't be altered, so we update via trigger or recreate)
-- Since the column already has a CHECK, we use a workaround:
ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_type_check;
ALTER TABLE skills ADD CONSTRAINT skills_type_check
  CHECK (type IN ('template', 'prompt_pack', 'style', 'niche', 'ai_prompt', 'voice_style', 'brand_kit'));

-- Seed enhanced built-in skills with AI configs
UPDATE skills SET
  system_prompt = 'You are a viral horror story narrator. Write in a suspenseful, atmospheric tone. Use short punchy sentences. Build tension with sensory details.',
  temperature = 0.8,
  max_tokens = 1500
WHERE name = 'Spooky Stories Starter';

UPDATE skills SET
  system_prompt = 'You are a motivational speaker who creates viral short-form content. Write with high energy, conviction, and emotional resonance. Use power words and personal transformation stories.',
  temperature = 0.7,
  max_tokens = 1200
WHERE name = 'Motivational Pack';

UPDATE skills SET
  system_prompt = 'You are a tech expert who explains complex concepts in simple, engaging ways for social media. Use analogies, comparisons, and surprising facts. Keep it punchy.',
  temperature = 0.6,
  max_tokens = 1000
WHERE name = 'Tech Tips Quick';

-- Seed new AI-focused built-in skills
INSERT INTO skills (user_id, name, description, type, content, system_prompt, temperature, max_tokens, is_public) VALUES
  (
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
    'Viral Hooks Master',
    'AI prompt skill for generating scroll-stopping hooks for any niche',
    'ai_prompt',
    '{"niche": "general", "language": "English", "visual_style": "cinematic"}',
    'You are the world''s best viral hook writer. Generate 5 scroll-stopping opening hooks for the given topic. Each hook should use a proven formula: curiosity gap, shocking fact, relatable pain point, bold claim, or question. Make them irresistible — the viewer MUST stop scrolling. Return as JSON array.',
    0.9,
    500,
    true
  ),
  (
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
    'Storyteller Pro',
    'AI prompt skill for narrative-driven content with emotional arc',
    'ai_prompt',
    '{"niche": "storytelling", "language": "English", "visual_style": "cinematic"}',
    'You are a master storyteller who creates viral short-form narratives. Structure: Hook (shocking opening) → Setup (relatable context) → Conflict (tension rises) → Twist (unexpected turn) → Resolution (satisfying payoff) → CTA. Write with vivid sensory details, emotional weight, and punchy pacing. Every word earns its place.',
    0.8,
    1500,
    true
  ),
  (
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
    'Brand Voice Kit',
    'Consistent brand voice configuration for content generation',
    'brand_kit',
    '{"brand_name": "My Brand", "tone": "professional yet approachable", "values": ["innovation", "authenticity"], "do_not_use": ["slang", "jargon"], "example_sentences": ["Welcome to the future of content."]}',
    NULL,
    0.7,
    1024,
    true
  );
