import { supabase } from '@/db/supabase';
import type { Series, Video, SocialConnection, AnalyticsRecord, ScheduledPost, Notification } from '@/types/types';

// ── Series ──────────────────────────────────────────────────────────────
export const seriesApi = {
  list: async (): Promise<Series[]> => {
    const { data, error } = await supabase
      .from('series')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  get: async (id: string): Promise<Series | null> => {
    const { data } = await supabase.from('series').select('*').eq('id', id).maybeSingle();
    return data ?? null;
  },

  create: async (payload: Omit<Series, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Series> => {
    const { data, error } = await supabase.from('series').insert(payload).select().maybeSingle();
    if (error) throw error;
    return data as Series;
  },

  update: async (id: string, payload: Partial<Series>): Promise<void> => {
    const { error } = await supabase.from('series').update(payload).eq('id', id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('series').update({ status: 'archived' }).eq('id', id);
    if (error) throw error;
  },
};

// ── Videos ──────────────────────────────────────────────────────────────
export const videosApi = {
  listBySeries: async (seriesId: string): Promise<Video[]> => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('series_id', seriesId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  listRecent: async (limit = 10): Promise<Video[]> => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) throw error;
  },

  create: async (payload: { series_id: string; title?: string }): Promise<Video> => {
    const { data, error } = await supabase
      .from('videos')
      .insert({ ...payload, status: 'queued' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data as Video;
  },

  update: async (id: string, payload: Partial<Video>): Promise<void> => {
    const { error } = await supabase.from('videos').update(payload).eq('id', id);
    if (error) throw error;
  },

  counts: async (): Promise<{ total: number; ready: number; scheduled: number }> => {
    const { data, error } = await supabase.from('videos').select('status');
    if (error) return { total: 0, ready: 0, scheduled: 0 };
    const all = Array.isArray(data) ? data : [];
    return {
      total: all.length,
      ready: all.filter(v => v.status === 'ready').length,
      scheduled: all.filter(v => v.status === 'scheduled').length,
    };
  },
};

// ── Connections ──────────────────────────────────────────────────────────
export const connectionsApi = {
  list: async (): Promise<SocialConnection[]> => {
    const { data, error } = await supabase
      .from('social_connections')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  upsert: async (payload: Omit<SocialConnection, 'id' | 'user_id' | 'connected_at' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('social_connections').upsert(payload, { onConflict: 'user_id,platform,account_id' });
    if (error) throw error;
  },

  disconnect: async (id: string): Promise<void> => {
    const { error } = await supabase.from('social_connections').update({ is_connected: false }).eq('id', id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('social_connections').delete().eq('id', id);
    if (error) throw error;
  },

  socialLogin: async (params: {
    platform: 'instagram' | 'facebook';
    username: string;
    password: string;
  }): Promise<{ success: boolean; data?: { platform: string; account_id: string; account_username: string; account_name: string; status: string }; error?: string; status?: string }> => {
    const { data, error } = await supabase.functions.invoke('social-login', { body: params });
    if (error) throw new Error(error.message);
    return data;
  },

  listCredentials: async (): Promise<Array<{
    id: string;
    platform: 'instagram' | 'youtube' | 'facebook';
    account_name: string | null;
    account_username: string | null;
    account_id: string | null;
    is_active: boolean;
    login_status: string;
    created_at: string;
  }>> => {
    const { data, error } = await supabase
      .from('social_credentials')
      .select('id,platform,account_name,account_username,account_id,is_active,login_status,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },
};

// ── Analytics ──────────────────────────────────────────────────────────
export const analyticsApi = {
  list: async (platform?: string, days = 30): Promise<AnalyticsRecord[]> => {
    let query = supabase
      .from('analytics')
      .select('*')
      .gte('recorded_date', new Date(Date.now() - days * 86400000).toISOString().split('T')[0])
      .order('recorded_date', { ascending: true })
      .limit(200);
    if (platform) query = query.eq('platform', platform);
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  latest: async (): Promise<{ instagram: AnalyticsRecord | null; youtube: AnalyticsRecord | null }> => {
    const [ig, yt] = await Promise.all([
      supabase.from('analytics').select('*').eq('platform', 'instagram').order('recorded_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('analytics').select('*').eq('platform', 'youtube').order('recorded_date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { instagram: ig.data ?? null, youtube: yt.data ?? null };
  },

  seedDemo: async (userId: string): Promise<void> => {
    const existing = await supabase.from('analytics').select('id').limit(1);
    if ((existing.data?.length ?? 0) > 0) return;

    const records = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const base = 29 - i;
      records.push(
        { user_id: userId, platform: 'instagram', recorded_date: date, views: 120 + base * 45 + Math.floor(Math.random() * 80), followers: 320 + base * 12, engagement_rate: 3.2 + Math.random() * 1.5, likes: 80 + base * 18, comments: 12 + base * 3, shares: 5 + base * 2, watch_hours: 0 },
        { user_id: userId, platform: 'youtube', recorded_date: date, views: 85 + base * 35 + Math.floor(Math.random() * 60), followers: 180 + base * 8, engagement_rate: 4.1 + Math.random() * 2, likes: 45 + base * 12, comments: 8 + base * 2, shares: 3 + base, watch_hours: 12 + base * 4.5 }
      );
    }
    await supabase.from('analytics').upsert(records, { onConflict: 'user_id,series_id,platform,recorded_date', ignoreDuplicates: true });
  },
};

// ── Scheduled Posts ──────────────────────────────────────────────────────
export const scheduledPostsApi = {
  list: async (days = 30): Promise<ScheduledPost[]> => {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', new Date(Date.now() + days * 86400000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  create: async (payload: Omit<ScheduledPost, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<void> => {
    const { error } = await supabase.from('scheduled_posts').insert(payload);
    if (error) throw error;
  },
};

// ── Notifications ──────────────────────────────────────────────────────
export const notificationsApi = {
  list: async (): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  markRead: async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },

  markAllRead: async (): Promise<void> => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  },
};
