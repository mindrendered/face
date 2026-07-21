-- Skills: uploadable content packs (templates, prompt packs, styles, niches)

CREATE TABLE skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('template', 'prompt_pack', 'style', 'niche')),
  content JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skills"
  ON skills FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view public skills"
  ON skills FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can insert their own skills"
  ON skills FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own skills"
  ON skills FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own skills"
  ON skills FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_skills_user_id ON skills(user_id);
CREATE INDEX idx_skills_type ON skills(type);
CREATE INDEX idx_skills_public ON skills(is_public) WHERE is_public = true;

-- Seed some built-in skills
INSERT INTO skills (user_id, name, description, type, content, is_public) VALUES
  (
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
    'Spooky Stories Starter',
    'Pre-built niche pack for horror/spooky story content',
    'niche',
    '{"niche": "Spooky Stories", "language": "English", "visual_style": "dark", "voice": "whisper", "music_style": "suspense", "suggested_hooks": ["You won''t believe what happened in this abandoned hospital...", "Stop scrolling. This story will keep you up tonight..."]}',
    true
  ),
  (
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
    'Motivational Pack',
    'High-energy motivational content template',
    'template',
    '{"niche": "Motivational", "language": "English", "visual_style": "cinematic", "voice": "energetic", "music_style": "upbeat", "suggested_hooks": ["This one habit changed my life forever...", "3 things successful people do before 6 AM..."]}',
    true
  ),
  (
    (SELECT id FROM profiles WHERE is_admin = true LIMIT 1),
    'Tech Tips Quick',
    'Quick tech tips and hacks for viral content',
    'prompt_pack',
    '{"niche": "Tech Tips", "language": "English", "visual_style": "neon", "voice": "neutral", "music_style": "lofi", "suggested_hooks": ["Your phone has a secret feature nobody knows about...", "Stop using Google like this..."]}',
    true
  );
