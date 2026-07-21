import { supabase } from '@/db/supabase';
import type { Series, Video, SocialConnection, AnalyticsRecord, ScheduledPost, Notification, SqlQuery } from '@/types/types';

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
    // Use efficient counting instead of fetching all rows
    const [totalRes, readyRes, scheduledRes] = await Promise.all([
      supabase.from('videos').select('id', { count: 'exact', head: true }),
      supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
      supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    ]);
    return {
      total: totalRes.count ?? 0,
      ready: readyRes.count ?? 0,
      scheduled: scheduledRes.count ?? 0,
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
    // Check if this user already has analytics data
    const existing = await supabase.from('analytics').select('id').eq('user_id', userId).limit(1);
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

// ── Payments ──────────────────────────────────────────────────────────────
export interface Payment {
  id: string;
  user_id: string;
  plan: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transaction_id: string | null;
  upi_id: string | null;
  upi_transaction_ref: string | null;
  payment_gateway: string | null;
  metadata: Record<string, unknown>;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const paymentsApi = {
  initiate: async (params: { plan: string; method: string }): Promise<{
    payment_id: string; invoice_number: string; plan: string; amount: number;
    currency: string; upi_id: string; upi_name: string; expires_at: string;
  }> => {
    const { data, error } = await supabase.functions.invoke('initiate-payment', { body: params });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Payment initiation failed');
    return data.data;
  },

  verify: async (params: { payment_id: string; method: string; transaction_ref: string; razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }): Promise<{
    payment_id: string; status: string; plan: string; amount: number;
  }> => {
    const { data, error } = await supabase.functions.invoke('verify-payment', { body: params });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Payment verification failed');
    return data.data;
  },

  list: async (): Promise<Payment[]> => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  listAll: async (): Promise<Payment[]> => {
    // Admin: list all payments across all users
    const { data, error } = await supabase
      .from('payments')
      .select('*, profiles!inner(email)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  updateStatus: async (paymentId: string, status: string, transactionId?: string): Promise<void> => {
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (transactionId) update.transaction_id = transactionId;
    if (status === 'completed') update.paid_at = new Date().toISOString();
    const { error } = await supabase.from('payments').update(update).eq('id', paymentId);
    if (error) throw error;
  },
};

// ── AI Providers ──────────────────────────────────────────────────────────
export interface AiProvider {
  id: string;
  user_id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'ollama' | 'custom';
  api_key: string | null;
  base_url: string | null;
  models: string[];
  is_active: boolean;
  priority: number;
  use_for: string[];
  created_at: string;
  updated_at: string;
}

export const aiProvidersApi = {
  list: async (): Promise<AiProvider[]> => {
    const { data, error } = await supabase
      .from('ai_providers')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  get: async (id: string): Promise<AiProvider | null> => {
    const { data } = await supabase.from('ai_providers').select('*').eq('id', id).maybeSingle();
    return data ?? null;
  },

  create: async (payload: Omit<AiProvider, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<AiProvider> => {
    const { data, error } = await supabase.from('ai_providers').insert(payload).select().maybeSingle();
    if (error) throw error;
    return data as AiProvider;
  },

  update: async (id: string, payload: Partial<AiProvider>): Promise<void> => {
    const { error } = await supabase.from('ai_providers').update(payload).eq('id', id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('ai_providers').delete().eq('id', id);
    if (error) throw error;
  },

  test: async (params: { provider: string; base_url: string; api_key: string; model: string }): Promise<{ success: boolean; latency_ms?: number; error?: string }> => {
    const { data, error } = await supabase.functions.invoke('test-ai-provider', { body: params });
    if (error) throw new Error(error.message);
    return data;
  },
};

// ── AI Usage ────────────────────────────────────────────────────────────────
export interface AiUsageRecord {
  id: string;
  user_id: string;
  provider_id: string | null;
  provider: string;
  model: string;
  use_case: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_estimate: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export const aiUsageApi = {
  list: async (days = 30, useCase?: string): Promise<AiUsageRecord[]> => {
    let query = supabase
      .from('ai_usage')
      .select('*')
      .gte('created_at', new Date(Date.now() - days * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500);
    if (useCase) query = query.eq('use_case', useCase);
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  stats: async (days = 30): Promise<{
    totalCalls: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
    avgLatencyMs: number;
    byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
    byUseCase: Record<string, { calls: number; tokens: number; cost: number }>;
  }> => {
    const records = await aiUsageApi.list(days);
    const byProvider: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const byUseCase: Record<string, { calls: number; tokens: number; cost: number }> = {};

    let totalTokensIn = 0, totalTokensOut = 0, totalCost = 0, totalLatency = 0;

    for (const r of records) {
      totalTokensIn += r.tokens_in;
      totalTokensOut += r.tokens_out;
      totalCost += r.cost_estimate;
      totalLatency += r.latency_ms;

      if (!byProvider[r.provider]) byProvider[r.provider] = { calls: 0, tokens: 0, cost: 0 };
      byProvider[r.provider].calls++;
      byProvider[r.provider].tokens += r.tokens_in + r.tokens_out;
      byProvider[r.provider].cost += r.cost_estimate;

      if (!byUseCase[r.use_case]) byUseCase[r.use_case] = { calls: 0, tokens: 0, cost: 0 };
      byUseCase[r.use_case].calls++;
      byUseCase[r.use_case].tokens += r.tokens_in + r.tokens_out;
      byUseCase[r.use_case].cost += r.cost_estimate;
    }

    return {
      totalCalls: records.length,
      totalTokensIn,
      totalTokensOut,
      totalCost,
      avgLatencyMs: records.length > 0 ? Math.round(totalLatency / records.length) : 0,
      byProvider,
      byUseCase,
    };
  },
};

// ── SQL Query Approval ─────────────────────────────────────────────────────
export const sqlQueriesApi = {
  submit: async (query: string): Promise<SqlQuery> => {
    const { data, error } = await supabase.functions.invoke('sql-editor', {
      body: { action: 'submit', query },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Submit failed');
    return data.data;
  },

  approve: async (queryId: string): Promise<void> => {
    const { data, error } = await supabase.functions.invoke('sql-editor', {
      body: { action: 'approve', query_id: queryId },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Approve failed');
  },

  reject: async (queryId: string, reason?: string): Promise<void> => {
    const { data, error } = await supabase.functions.invoke('sql-editor', {
      body: { action: 'reject', query_id: queryId, reason },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Reject failed');
  },

  execute: async (queryId: string): Promise<{ result: unknown; row_count: number | null }> => {
    const { data, error } = await supabase.functions.invoke('sql-editor', {
      body: { action: 'execute', query_id: queryId },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Execute failed');
    return data.data;
  },

  list: async (status?: string): Promise<SqlQuery[]> => {
    const { data, error } = await supabase.functions.invoke('sql-editor', {
      body: { action: 'list', query_id: status || 'all' },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'List failed');
    return data.data;
  },

  delete: async (queryId: string): Promise<void> => {
    const { data, error } = await supabase.functions.invoke('sql-editor', {
      body: { action: 'delete', query_id: queryId },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Delete failed');
  },
};

// ── Skills ─────────────────────────────────────────────────────────────────
export interface Skill {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: 'template' | 'prompt_pack' | 'style' | 'niche' | 'ai_prompt' | 'voice_style' | 'brand_kit';
  content: Record<string, unknown>;
  is_public: boolean;
  downloads: number;
  ai_provider_id: string | null;
  system_prompt: string | null;
  model_override: string | null;
  temperature: number | null;
  max_tokens: number | null;
  created_at: string;
  updated_at: string;
}

export const skillsApi = {
  get: async (id: string): Promise<Skill | null> => {
    const { data } = await supabase.from('skills').select('*').eq('id', id).maybeSingle();
    return data ?? null;
  },

  list: async (type?: string): Promise<Skill[]> => {
    let q = supabase.from('skills').select('*').order('created_at', { ascending: false }).limit(50);
    if (type) q = q.eq('type', type);
    const { data, error } = await q;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  listPublic: async (type?: string): Promise<Skill[]> => {
    let q = supabase.from('skills').select('*').eq('is_public', true).order('downloads', { ascending: false }).limit(50);
    if (type) q = q.eq('type', type);
    const { data, error } = await q;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  create: async (payload: Omit<Skill, 'id' | 'user_id' | 'downloads' | 'created_at' | 'updated_at'>): Promise<Skill> => {
    const { data, error } = await supabase.from('skills').insert(payload).select().maybeSingle();
    if (error) throw error;
    return data as Skill;
  },

  update: async (id: string, payload: Partial<Skill>): Promise<void> => {
    const { error } = await supabase.from('skills').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) throw error;
  },

  exportJson: (skill: Skill): string => {
    return JSON.stringify({
      name: skill.name,
      description: skill.description,
      type: skill.type,
      content: skill.content,
    }, null, 2);
  },

  importJson: (json: string): Omit<Skill, 'id' | 'user_id' | 'downloads' | 'created_at' | 'updated_at'> => {
    const parsed = JSON.parse(json);
    return {
      name: parsed.name || 'Imported Skill',
      description: parsed.description || null,
      type: parsed.type || 'template',
      content: parsed.content || {},
      is_public: false,
      system_prompt: parsed.system_prompt || null,
      model_override: parsed.model_override || null,
      temperature: parsed.temperature ?? 0.7,
      max_tokens: parsed.max_tokens ?? 1024,
      ai_provider_id: parsed.ai_provider_id || null,
    };
  },
};
