export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: 'beginner' | 'daily' | 'pro';
  videos_generated_count: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface SqlQuery {
  id: string;
  query: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  created_by: string;
  creator_email?: string;
  approved_by: string | null;
  result: unknown;
  row_count: number | null;
  error_message: string | null;
  executed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Series {
  id: string;
  user_id: string;
  name: string;
  language: string;
  niche: string;
  niche_custom: string | null;
  visual_style: string;
  voice: string;
  music_style: string;
  caption_style: string;
  status: 'active' | 'paused' | 'archived';
  auto_posting_enabled: boolean;
  instagram_account_id: string | null;
  youtube_account_id: string | null;
  skill_id: string | null;
  posting_frequency: '3x_week' | 'daily' | 'pro';
  posting_days: string[];
  posting_time: string;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  series_id: string;
  user_id: string;
  title: string | null;
  script: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  status: 'queued' | 'generating_script' | 'generating_visuals' | 'generating_video' | 'ready' | 'posted' | 'failed' | 'scheduled';
  generation_stage: string | null;
  generation_progress: number;
  retry_count: number;
  error_message: string | null;
  duration_seconds: number | null;
  platform_posted: string[];
  scheduled_at: string | null;
  posted_at: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialConnection {
  id: string;
  user_id: string;
  platform: 'instagram' | 'youtube';
  account_name: string;
  account_id: string;
  is_connected: boolean;
  connected_at: string;
  created_at: string;
}

export interface AnalyticsRecord {
  id: string;
  user_id: string;
  series_id: string | null;
  platform: 'instagram' | 'youtube';
  recorded_date: string;
  views: number;
  followers: number;
  engagement_rate: number;
  likes: number;
  comments: number;
  shares: number;
  watch_hours: number;
  created_at: string;
}

export interface ScheduledPost {
  id: string;
  user_id: string;
  series_id: string;
  video_id: string | null;
  platform: 'instagram' | 'youtube';
  scheduled_at: string;
  status: 'pending' | 'posting' | 'posted' | 'failed' | 'cancelled';
  posted_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'video_ready' | 'video_failed' | 'post_success' | 'post_failed' | 'monetization_alert' | 'plan_limit';
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type PlanTier = 'beginner' | 'daily' | 'pro';

export const PLAN_DETAILS: Record<PlanTier, { name: string; price: number; videos: number; frequency: string; description: string }> = {
  beginner: { name: 'Beginner', price: 19, videos: 12, frequency: '3× per week', description: 'Great for getting started' },
  daily: { name: 'Daily', price: 39, videos: 30, frequency: 'Every day', description: 'Stay consistent daily' },
  pro: { name: 'Pro', price: 79, videos: 60, frequency: '~60 videos/month', description: 'Maximum growth & output' },
};

export const NICHES = [
  'Spooky Stories', 'Motivational', 'Fitness & Health', 'Tech Tips', 'Finance & Wealth',
  'Travel & Adventure', 'True Crime', 'History Facts', 'Life Hacks', 'Science Facts',
  'Relationship Advice', 'Cooking & Recipes', 'Nature & Wildlife', 'Psychology Facts',
  'Space & Universe', 'Business Tips', 'Custom',
];

export const VISUAL_STYLES = [
  { id: 'cinematic', label: 'Cinematic', description: 'Dark, moody, film-like' },
  { id: 'minimalist', label: 'Minimalist', description: 'Clean, simple, white space' },
  { id: 'dark', label: 'Dark & Dramatic', description: 'High contrast, deep tones' },
  { id: 'bright', label: 'Bright & Vibrant', description: 'Colorful, energetic' },
  { id: 'vintage', label: 'Vintage', description: 'Retro, film grain, warm tones' },
  { id: 'neon', label: 'Neon & Futuristic', description: 'Glowing, tech-forward' },
];

export const VOICES = [
  { id: 'neutral', label: 'Neutral', description: 'Clear, professional tone' },
  { id: 'deep', label: 'Deep & Authoritative', description: 'Rich, commanding voice' },
  { id: 'warm', label: 'Warm & Friendly', description: 'Approachable, conversational' },
  { id: 'energetic', label: 'Energetic', description: 'High-energy, motivating' },
  { id: 'whisper', label: 'Whisper', description: 'Soft, intimate, mysterious' },
  { id: 'storyteller', label: 'Storyteller', description: 'Narrative, engaging delivery' },
];

export const MUSIC_STYLES = [
  { id: 'ambient', label: 'Ambient', description: 'Atmospheric background' },
  { id: 'cinematic', label: 'Cinematic', description: 'Dramatic orchestral' },
  { id: 'lofi', label: 'Lo-Fi', description: 'Chill, relaxed vibes' },
  { id: 'upbeat', label: 'Upbeat', description: 'Energetic, motivational' },
  { id: 'suspense', label: 'Suspenseful', description: 'Tense, mysterious' },
  { id: 'none', label: 'No Music', description: 'Voice only' },
];

export const CAPTION_STYLES = [
  { id: 'bold', label: 'Bold', description: 'Large, high-contrast text' },
  { id: 'minimal', label: 'Minimal', description: 'Clean, understated' },
  { id: 'animated', label: 'Animated', description: 'Word-by-word reveal' },
  { id: 'subtitle', label: 'Subtitle', description: 'Traditional bottom bar' },
];

export const LANGUAGES = [
  'English', 'Malayalam', 'Spanish', 'French', 'Portuguese', 'German',
  'Italian', 'Dutch', 'Polish', 'Japanese', 'Korean',
];
