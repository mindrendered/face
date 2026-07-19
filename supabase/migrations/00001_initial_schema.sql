
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  plan text NOT NULL DEFAULT 'beginner' CHECK (plan IN ('beginner', 'daily', 'pro')),
  videos_generated_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Series table
CREATE TABLE series (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'English',
  niche text NOT NULL,
  niche_custom text,
  visual_style text NOT NULL DEFAULT 'cinematic',
  voice text NOT NULL DEFAULT 'neutral',
  music_style text NOT NULL DEFAULT 'ambient',
  caption_style text NOT NULL DEFAULT 'bold',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  auto_posting_enabled boolean NOT NULL DEFAULT false,
  instagram_account_id uuid,
  youtube_account_id uuid,
  posting_frequency text NOT NULL DEFAULT 'daily' CHECK (posting_frequency IN ('3x_week', 'daily', 'pro')),
  posting_days text[] DEFAULT '{}',
  posting_time text DEFAULT '09:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Videos table
CREATE TABLE videos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text,
  script text,
  thumbnail_url text,
  video_url text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating_script', 'generating_visuals', 'generating_video', 'ready', 'posted', 'failed', 'scheduled')),
  generation_stage text,
  generation_progress integer DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  error_message text,
  duration_seconds integer,
  platform_posted text[] DEFAULT '{}',
  scheduled_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Social connections table
CREATE TABLE social_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'youtube')),
  account_name text NOT NULL,
  account_id text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_connected boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, account_id)
);

-- Analytics table (daily snapshots)
CREATE TABLE analytics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  series_id uuid REFERENCES series(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'youtube')),
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  views bigint NOT NULL DEFAULT 0,
  followers bigint NOT NULL DEFAULT 0,
  engagement_rate numeric(5,2) DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  watch_hours numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, series_id, platform, recorded_date)
);

-- Scheduled posts table
CREATE TABLE scheduled_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  video_id uuid REFERENCES videos(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'youtube')),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posting', 'posted', 'failed', 'cancelled')),
  posted_at timestamptz,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video_ready', 'video_failed', 'post_success', 'post_failed', 'monetization_alert', 'plan_limit')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_series_user_id ON series(user_id);
CREATE INDEX idx_videos_series_id ON videos(series_id);
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX idx_analytics_user_id ON analytics(user_id);
CREATE INDEX idx_analytics_recorded_date ON analytics(recorded_date);
CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER series_updated_at BEFORE UPDATE ON series FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Series RLS
CREATE POLICY "series_select_own" ON series FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "series_insert_own" ON series FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "series_update_own" ON series FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "series_delete_own" ON series FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Videos RLS
CREATE POLICY "videos_select_own" ON videos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "videos_insert_own" ON videos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "videos_update_own" ON videos FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "videos_delete_own" ON videos FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Social connections RLS
CREATE POLICY "connections_select_own" ON social_connections FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "connections_insert_own" ON social_connections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "connections_update_own" ON social_connections FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "connections_delete_own" ON social_connections FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Analytics RLS
CREATE POLICY "analytics_select_own" ON analytics FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "analytics_insert_own" ON analytics FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "analytics_update_own" ON analytics FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Scheduled posts RLS
CREATE POLICY "scheduled_posts_select_own" ON scheduled_posts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "scheduled_posts_insert_own" ON scheduled_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "scheduled_posts_update_own" ON scheduled_posts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "scheduled_posts_delete_own" ON scheduled_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Notifications RLS
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Seed demo analytics data helper function (used for chart display)
