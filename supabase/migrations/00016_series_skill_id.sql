
-- Add skill_id to series so AI skill config persists across video generations
ALTER TABLE series ADD COLUMN IF NOT EXISTS skill_id uuid REFERENCES skills(id) ON DELETE SET NULL;
CREATE INDEX idx_series_skill_id ON series(skill_id) WHERE skill_id IS NOT NULL;
