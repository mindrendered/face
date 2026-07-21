import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Shield, Save, RefreshCw, Users, CreditCard, Bot, Clock,
  Bell, Palette, BarChart3, AlertTriangle, Server, Trash2, Eye,
  Globe, Database, Link2, Zap, Activity, TrendingUp, Film,
  ExternalLink, Search, ChevronDown, X, Check, Instagram, Youtube,
  Settings, ArrowLeft, Crown, Skull, Terminal, FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AIStudio } from '@/components/AIStudio';

// ── Types ───────────────────────────────────────────────────────────────────
interface PlatformSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  is_admin: boolean;
  videos_generated_count: number;
  created_at: string;
}

interface PlanConfig {
  price: number;
  videos_per_month: number;
  frequency: string;
  label: string;
}

interface PlansConfig {
  beginner: PlanConfig;
  daily: PlanConfig;
  pro: PlanConfig;
}

interface DashboardStats {
  totalUsers: number;
  totalVideos: number;
  totalSeries: number;
  activeUsers: number;
  planBreakdown: { beginner: number; daily: number; pro: number };
}

// ── Admin Nav Items ─────────────────────────────────────────────────────────
const adminNav = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'plans', label: 'Plans & Pricing', icon: CreditCard },
  { key: 'payments', label: 'Payments & UPI', icon: CreditCard },
  { key: 'ai', label: 'AI Generation', icon: Bot },
  { key: 'ai-providers', label: 'AI Providers', icon: Server },
  { key: 'ai-usage', label: 'AI Usage', icon: Activity },
  { key: 'posting', label: 'Auto-Posting', icon: Clock },
  { key: 'moderation', label: 'Content Moderation', icon: AlertTriangle },
  { key: 'limits', label: 'Platform Limits', icon: Globe },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'analytics', label: 'Analytics Config', icon: Activity },
  { key: 'connections', label: 'Social Connections', icon: Link2 },
  { key: 'database', label: 'Database', icon: Database },
  { key: 'ai-studio', label: 'AI Studio', icon: Zap },
  { key: 'sql-editor', label: 'SQL Editor', icon: Terminal },
  { key: 'users', label: 'User Management', icon: Users },
];

// ── Setting Groups ──────────────────────────────────────────────────────────
const SETTING_GROUPS: Record<string, { label: string; icon: ReactNode; keys: string[]; descriptions?: Record<string, string> }> = {
  ai: {
    label: 'AI Generation',
    icon: <Bot size={14} />,
    keys: ['ai_script_model', 'ai_script_max_tokens', 'ai_video_provider', 'ai_video_max_duration', 'ai_image_provider'],
    descriptions: {
      ai_script_model: 'LLM model used for script generation (e.g. gemini-2.5-flash)',
      ai_script_max_tokens: 'Maximum tokens the LLM can generate per script',
      ai_video_provider: 'Video generation service (kling, runway, pika)',
      ai_video_max_duration: 'Maximum video length in seconds (5 or 10)',
      ai_image_provider: 'Image generation service provider',
    },
  },
  posting: {
    label: 'Auto-Posting',
    icon: <Clock size={14} />,
    keys: ['auto_post_enabled', 'post_retry_max', 'post_retry_delay_minutes', 'posting_window_start', 'posting_window_end'],
    descriptions: {
      auto_post_enabled: 'Master switch — enable or disable all auto-posting',
      post_retry_max: 'How many times to retry a failed post before giving up',
      post_retry_delay_minutes: 'Minutes to wait between retry attempts',
      posting_window_start: 'Earliest time of day posts can be published (UTC)',
      posting_window_end: 'Latest time of day posts can be published (UTC)',
    },
  },
  moderation: {
    label: 'Content Moderation',
    icon: <AlertTriangle size={14} />,
    keys: ['content_moderation_enabled', 'max_script_length', 'blocked_niches'],
    descriptions: {
      content_moderation_enabled: 'Screen generated content before publishing',
      max_script_length: 'Maximum characters allowed in a generated script',
      blocked_niches: 'JSON array of niche names blocked from generation',
    },
  },
  limits: {
    label: 'Plan Limits',
    icon: <Globe size={14} />,
    keys: ['max_series_per_user_beginner', 'max_series_per_user_daily', 'max_series_per_user_pro'],
    descriptions: {
      max_series_per_user_beginner: 'Max series a Beginner plan user can create',
      max_series_per_user_daily: 'Max series a Daily plan user can create',
      max_series_per_user_pro: 'Max series a Pro plan user can create',
    },
  },
  notifications: {
    label: 'Notifications',
    icon: <Bell size={14} />,
    keys: ['email_notifications_enabled', 'notify_on_video_ready', 'notify_on_post_fail', 'notify_on_plan_limit'],
    descriptions: {
      email_notifications_enabled: 'Master switch for all email notifications',
      notify_on_video_ready: 'Email users when their video is ready',
      notify_on_post_fail: 'Email users when a post fails to publish',
      notify_on_plan_limit: 'Alert users when approaching their plan limits',
    },
  },
  branding: {
    label: 'Branding',
    icon: <Palette size={14} />,
    keys: ['platform_name', 'platform_tagline', 'support_email', 'maintenance_mode'],
    descriptions: {
      platform_name: 'Display name shown in the app and emails',
      platform_tagline: 'Tagline shown on the landing page',
      support_email: 'Contact email for user support',
      maintenance_mode: 'When enabled, users see a maintenance page',
    },
  },
  analytics: {
    label: 'Analytics Config',
    icon: <Activity size={14} />,
    keys: ['analytics_retention_days', 'demo_data_enabled'],
    descriptions: {
      analytics_retention_days: 'Days to keep analytics data before auto-deletion',
      demo_data_enabled: 'Seed demo analytics data for new users',
    },
  },
  payment: {
    label: 'Payment Gateway',
    icon: <CreditCard size={14} />,
    keys: [
      'payment_enabled', 'payment_currency', 'payment_currency_symbol', 'payment_gateway',
      'payment_upi_enabled', 'payment_upi_id', 'payment_upi_name', 'payment_upi_qr_enabled', 'payment_upi_merchant_code',
      'payment_razorpay_enabled', 'payment_razorpay_key_id', 'payment_razorpay_key_secret',
      'payment_stripe_enabled', 'payment_stripe_publishable_key', 'payment_stripe_secret_key',
      'payment_cashfree_enabled', 'payment_cashfree_app_id', 'payment_cashfree_secret_key',
    ],
    descriptions: {
      payment_enabled: 'Master switch — enable or disable all payments',
      payment_currency: 'Default currency code (INR, USD, EUR, etc.)',
      payment_currency_symbol: 'Currency symbol for display (₹, $, €, etc.)',
      payment_gateway: 'Active payment gateway (manual, razorpay, stripe, cashfree)',
      payment_upi_enabled: 'Enable UPI payments',
      payment_upi_id: 'Primary UPI ID for receiving payments (e.g. name@upi)',
      payment_upi_name: 'Display name shown on UPI payment screen',
      payment_upi_qr_enabled: 'Show QR code for UPI payments',
      payment_upi_merchant_code: 'UPI merchant code (optional)',
      payment_razorpay_enabled: 'Enable Razorpay payment gateway',
      payment_razorpay_key_id: 'Razorpay API Key ID',
      payment_razorpay_key_secret: 'Razorpay API Key Secret',
      payment_stripe_enabled: 'Enable Stripe payment gateway',
      payment_stripe_publishable_key: 'Stripe Publishable Key',
      payment_stripe_secret_key: 'Stripe Secret Key',
      payment_cashfree_enabled: 'Enable Cashfree payment gateway',
      payment_cashfree_app_id: 'Cashfree App ID',
      payment_cashfree_secret_key: 'Cashfree Secret Key',
    },
  },
  'payment-behavior': {
    label: 'Payment Behavior',
    icon: <Clock size={14} />,
    keys: [
      'payment_expiry_minutes', 'payment_retry_allowed', 'payment_auto_activate',
      'payment_receipt_enabled', 'payment_success_redirect', 'payment_failed_redirect',
    ],
    descriptions: {
      payment_expiry_minutes: 'Payment link expiry time in minutes',
      payment_retry_allowed: 'Allow retrying failed payments',
      payment_auto_activate: 'Auto-activate plan after successful payment',
      payment_receipt_enabled: 'Generate payment receipts',
      payment_success_redirect: 'Redirect URL after successful payment',
      payment_failed_redirect: 'Redirect URL after failed payment',
    },
  },
  subscription: {
    label: 'Subscriptions',
    icon: <RefreshCw size={14} />,
    keys: [
      'subscription_expiry_enabled', 'subscription_grace_period_days', 'subscription_auto_renew_reminder',
    ],
    descriptions: {
      subscription_expiry_enabled: 'Expire subscriptions at period end',
      subscription_grace_period_days: 'Grace period after subscription expiry',
      subscription_auto_renew_reminder: 'Send reminder before renewal',
    },
  },
  tax: {
    label: 'Tax & Compliance',
    icon: <AlertTriangle size={14} />,
    keys: [
      'payment_gst_enabled', 'payment_gst_rate', 'payment_gst_number',
      'payment_invoice_prefix', 'payment_invoice_start',
    ],
    descriptions: {
      payment_gst_enabled: 'Apply GST on payments',
      payment_gst_rate: 'GST rate in percentage',
      payment_gst_number: 'GSTIN number for invoices',
      payment_invoice_prefix: 'Invoice number prefix',
      payment_invoice_start: 'Starting invoice number',
    },
  },
};

// ── Helper Functions ────────────────────────────────────────────────────────
function isBoolSetting(value: unknown): boolean {
  return value === true || value === false || value === 'true' || value === 'false';
}

function getBoolValue(value: unknown): boolean {
  return value === true || value === 'true';
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: ReactNode; color: string; sub?: string }) {
  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Settings Panel (reusable) ───────────────────────────────────────────────
function SettingsPanel({ groupKey, settings, loadingSettings, savingKey, updateSetting }: {
  groupKey: string;
  settings: PlatformSetting[];
  loadingSettings: boolean;
  savingKey: string | null;
  updateSetting: (key: string, value: unknown) => void;
}) {
  const group = SETTING_GROUPS[groupKey];
  if (!group) return null;
  const groupSettings = settings.filter(s => group.keys.includes(s.key));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <span className="text-primary">{group.icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-bold">{group.label}</h3>
          <p className="text-xs text-muted-foreground">Configure {group.label.toLowerCase()} settings</p>
        </div>
      </div>
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          {loadingSettings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : groupSettings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings size={20} className="text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No settings found for this group.</p>
              <p className="text-xs text-muted-foreground mt-1">Deploy the migration to seed these settings.</p>
            </div>
          ) : (
            groupSettings.map((setting, i) => (
              <div key={setting.key} className={cn(
                'flex items-center gap-4 px-5 py-4',
                i < groupSettings.length - 1 && 'border-b border-border'
              )}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-mono">{setting.key}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.descriptions?.[setting.key] || setting.description || 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isBoolSetting(setting.value) ? (
                    <Switch
                      checked={getBoolValue(setting.value)}
                      onCheckedChange={(checked) => updateSetting(setting.key, checked)}
                      disabled={savingKey === setting.key}
                    />
                  ) : (
                    <Input
                      defaultValue={String(setting.value ?? '')}
                      onBlur={e => {
                        const raw = e.target.value;
                        let parsed: unknown = raw;
                        try { parsed = JSON.parse(raw); } catch { /* keep raw */ }
                        if (String(parsed) !== String(setting.value)) {
                          updateSetting(setting.key, parsed);
                        }
                      }}
                      className="h-9 w-56 text-xs px-3"
                    />
                  )}
                  {savingKey === setting.key && <Loader2 size={12} className="animate-spin text-primary" />}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Admin Page ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const { isAdmin, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlansConfig | null>(null);
  const [editedPlans, setEditedPlans] = useState<PlansConfig | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, totalVideos: 0, totalSeries: 0, activeUsers: 0,
    planBreakdown: { beginner: 0, daily: 0, pro: 0 },
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, authLoading, navigate]);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('platform_settings').select('*').order('key');
    setSettings((data ?? []) as PlatformSetting[]);
    const plansSetting = (data ?? []).find(s => s.key === 'plans');
    if (plansSetting) {
      const p = plansSetting.value as PlansConfig;
      setPlans(p);
      setEditedPlans(JSON.parse(JSON.stringify(p)));
    }
    setLoadingSettings(false);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan, is_admin, videos_generated_count, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    const rows = (data ?? []) as UserRow[];
    setUsers(rows);

    // Compute stats
    const planBreakdown = { beginner: 0, daily: 0, pro: 0 };
    rows.forEach(u => {
      if (u.plan in planBreakdown) planBreakdown[u.plan as keyof typeof planBreakdown]++;
    });

    // Get video count
    const { count: videoCount } = await supabase.from('videos').select('id', { count: 'exact', head: true });
    const { count: seriesCount } = await supabase.from('series').select('id', { count: 'exact', head: true });

    // Active users (logged in within 7 days — approximate via profile updated_at)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: activeCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', sevenDaysAgo);

    setStats({
      totalUsers: rows.length,
      totalVideos: videoCount ?? 0,
      totalSeries: seriesCount ?? 0,
      activeUsers: activeCount ?? 0,
      planBreakdown,
    });
    setLoadingUsers(false);
  }, []);

  useEffect(() => { loadSettings(); loadUsers(); }, [loadSettings, loadUsers]);

  const savePlans = async () => {
    if (!editedPlans) return;
    setSavingKey('plans');
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value: editedPlans, updated_at: new Date().toISOString() })
        .eq('key', 'plans');
      if (error) throw error;
      setPlans(editedPlans);
      toast.success('Plans updated');
      await loadSettings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  const updateSetting = async (key: string, value: unknown) => {
    setSavingKey(key);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
      toast.success('Setting saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleAdmin = async (userId: string, current: boolean) => {
    const { error } = await supabase.rpc('toggle_user_admin', { target_user_id: userId, new_admin_status: !current });
    if (error) { toast.error('Update failed'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !current } : u));
    toast.success(`Admin ${!current ? 'granted' : 'revoked'}`);
  };

  const changePlan = async (userId: string, plan: string) => {
    const { error } = await supabase.from('profiles').update({ plan }).eq('id', userId);
    if (error) { toast.error('Update failed'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
    toast.success('Plan updated');
  };

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const deleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (user.id === profile?.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    if (!confirm(`Delete ${user.email}? This will permanently remove their account and all associated data.`)) return;
    setDeletingUserId(userId);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) { toast.error('Delete failed'); return; }
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (!isAdmin) return null;

  const planKeys = ['beginner', 'daily', 'pro'] as const;
  const filteredUsers = searchQuery
    ? users.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  // ── Overview Section ────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={formatNumber(stats.totalUsers)} icon={<Users size={18} className="text-blue-600" />} color="bg-blue-50 dark:bg-blue-950" />
        <StatCard label="Total Videos" value={formatNumber(stats.totalVideos)} icon={<Film size={18} className="text-purple-600" />} color="bg-purple-50 dark:bg-purple-950" />
        <StatCard label="Total Series" value={formatNumber(stats.totalSeries)} icon={<FolderOpen size={18} className="text-green-600" />} color="bg-green-50 dark:bg-green-950" />
        <StatCard label="Active (7d)" value={formatNumber(stats.activeUsers)} icon={<Activity size={18} className="text-orange-600" />} color="bg-orange-50 dark:bg-orange-950" />
      </div>

      {/* Plan Breakdown */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CreditCard size={14} className="text-primary" />
            Plan Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-3 gap-4">
            {planKeys.map(pk => {
              const count = stats.planBreakdown[pk];
              const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
              const colors = { beginner: 'text-blue-600 bg-blue-50 dark:bg-blue-950', daily: 'text-green-600 bg-green-50 dark:bg-green-950', pro: 'text-purple-600 bg-purple-50 dark:bg-purple-950' };
              return (
                <div key={pk} className="text-center p-4 rounded-xl border border-border">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', colors[pk])}>
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                  <p className="text-sm font-bold capitalize">{pk}</p>
                  <p className="text-xs text-muted-foreground">{pct}% of users</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Edit Plans', icon: CreditCard, section: 'plans' },
          { label: 'AI Config', icon: Bot, section: 'ai' },
          { label: 'SQL Editor', icon: Terminal, section: 'sql-editor' },
          { label: 'Manage Users', icon: Users, section: 'users' },
        ].map(item => (
          <button
            key={item.section}
            onClick={() => setActiveSection(item.section)}
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
          >
            <item.icon size={16} className="text-primary" />
            <span className="text-xs font-semibold">{item.label}</span>
          </button>
        ))}
      </div>

      {/* System Info */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Server size={14} className="text-primary" />
            System Info
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {[
              { label: 'Platform', value: settings.find(s => s.key === 'platform_name')?.value || 'Faceless' },
              { label: 'Script Model', value: settings.find(s => s.key === 'ai_script_model')?.value || 'gemini-2.5-flash' },
              { label: 'Video Provider', value: settings.find(s => s.key === 'ai_video_provider')?.value || 'kling' },
              { label: 'Maintenance', value: settings.find(s => s.key === 'maintenance_mode')?.value === true || settings.find(s => s.key === 'maintenance_mode')?.value === 'true' ? 'ON' : 'OFF' },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground font-semibold">{item.label}</p>
                <p className="font-bold mt-1">{String(item.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Plans Section ───────────────────────────────────────────────────────
  const renderPlans = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <CreditCard size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Subscription Plans</h3>
            <p className="text-xs text-muted-foreground">Configure pricing and video limits for each plan</p>
          </div>
        </div>
        <Button size="sm" className="h-9 text-xs gradient-bg border-0 text-white font-semibold" onClick={savePlans} disabled={savingKey === 'plans'}>
          {savingKey === 'plans' ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Save size={12} className="mr-1.5" />}
          Save plans
        </Button>
      </div>
      {editedPlans ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {planKeys.map(pk => (
            <Card key={pk} className="border-2 border-border shadow-none hover:border-primary/30 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold capitalize">{pk}</h4>
                  <Badge variant="outline" className="text-[10px]">{editedPlans[pk].videos_per_month} vids/mo</Badge>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Price ($/month)</Label>
                    <Input type="number" min="0" value={editedPlans[pk].price}
                      onChange={e => setEditedPlans(p => p ? { ...p, [pk]: { ...p[pk], price: parseInt(e.target.value) || 0 } } : p)}
                      className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Videos/month</Label>
                    <Input type="number" min="1" value={editedPlans[pk].videos_per_month}
                      onChange={e => setEditedPlans(p => p ? { ...p, [pk]: { ...p[pk], videos_per_month: parseInt(e.target.value) || 1 } } : p)}
                      className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Frequency</Label>
                    <Input value={editedPlans[pk].frequency}
                      onChange={e => setEditedPlans(p => p ? { ...p, [pk]: { ...p[pk], frequency: e.target.value } } : p)}
                      className="h-9 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border border-border shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard size={24} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No plan data. Deploy migration 00008 to seed plans.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Users Section ───────────────────────────────────────────────────────
  const renderUsers = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <Users size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">User Management</h3>
            <p className="text-xs text-muted-foreground">{filteredUsers.length} users total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-56 text-xs pl-8" />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 border border-border" onClick={loadUsers} aria-label="Refresh users">
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px]">
                <thead>
                  <tr className="border-b border-border">
                    {['User', 'Plan', 'Videos', 'Role', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3 px-5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-5">
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">{u.email}</p>
                          {u.full_name && <p className="text-xs text-muted-foreground">{u.full_name}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <select value={u.plan} onChange={e => changePlan(u.id, e.target.value)}
                          className="text-xs border-2 border-border rounded-lg px-2 py-1.5 bg-background font-semibold hover:border-primary/40 transition-colors">
                          <option value="beginner">Beginner</option>
                          <option value="daily">Daily</option>
                          <option value="pro">Pro</option>
                        </select>
                      </td>
                      <td className="py-3 px-5 text-sm font-bold whitespace-nowrap">{u.videos_generated_count}</td>
                      <td className="py-3 px-5">
                        <Badge className={cn('text-[10px] cursor-pointer font-bold border-0',
                          u.is_admin ? 'gradient-bg text-white' : 'bg-muted text-muted-foreground'
                        )} onClick={() => toggleAdmin(u.id, u.is_admin)}>
                          {u.is_admin ? 'Admin' : 'User'}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold" onClick={() => toggleAdmin(u.id, u.is_admin)}>
                            {u.is_admin ? 'Revoke' : 'Make admin'}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive font-semibold" onClick={() => deleteUser(u.id)} disabled={deletingUserId === u.id}>
                            {deletingUserId === u.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Connections Section ─────────────────────────────────────────────────
  const renderConnections = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <Link2 size={14} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Social Connections</h3>
          <p className="text-xs text-muted-foreground">All connected Instagram, Facebook, and YouTube accounts across users</p>
        </div>
      </div>
      <ConnectionsPanel />
    </div>
  );

  // ── Database Section ────────────────────────────────────────────────────
  const renderDatabase = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <Database size={14} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Database Management</h3>
          <p className="text-xs text-muted-foreground">View table counts and manage data</p>
        </div>
      </div>
      <DatabasePanel />
    </div>
  );

  // ── Section Router ──────────────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'plans': return renderPlans();
      case 'ai': return <SettingsPanel groupKey="ai" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'ai-providers': return <AiProvidersPanel />;
      case 'ai-usage': return <AiUsagePanel />;
      case 'posting': return <SettingsPanel groupKey="posting" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'moderation': return <SettingsPanel groupKey="moderation" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'limits': return <SettingsPanel groupKey="limits" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'notifications': return <SettingsPanel groupKey="notifications" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'branding': return <SettingsPanel groupKey="branding" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'analytics': return <SettingsPanel groupKey="analytics" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'payments': return <SettingsPanel groupKey="payment" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'payment-behavior': return <SettingsPanel groupKey="payment-behavior" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'subscription': return <SettingsPanel groupKey="subscription" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'tax': return <SettingsPanel groupKey="tax" settings={settings} loadingSettings={loadingSettings} savingKey={savingKey} updateSetting={updateSetting} />;
      case 'connections': return renderConnections();
      case 'database': return renderDatabase();
      case 'ai-studio': return <AIStudio />;
      case 'sql-editor': return <SqlEditorSection />;
      case 'users': return renderUsers();
      default: return renderOverview();
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Admin Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-muted/20 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center">
              <Shield size={13} className="text-white" />
            </div>
            <span className="text-xs font-bold">Admin Panel</span>
          </div>
        </div>
        {adminNav.map(item => {
          const active = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <item.icon size={13} />
              {item.label}
            </button>
          );
        })}
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        {/* Mobile Section Selector */}
        <div className="lg:hidden mb-4">
          <select value={activeSection} onChange={e => setActiveSection(e.target.value)}
            className="w-full h-10 text-sm font-semibold border border-border rounded-lg px-3 bg-background">
            {adminNav.map(item => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">
            {adminNav.find(n => n.key === activeSection)?.label || 'Admin'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {activeSection === 'overview' && 'Platform overview and quick actions'}
            {activeSection === 'plans' && 'Configure subscription pricing and video limits'}
            {activeSection === 'ai' && 'AI model configuration for script, video, and image generation'}
            {activeSection === 'ai-providers' && 'Configure API keys for OpenAI, Anthropic, Google, Mistral, Ollama, and custom providers'}
            {activeSection === 'ai-usage' && 'Monitor AI token usage, costs, and latency across all providers'}
            {activeSection === 'posting' && 'Auto-posting rules, retry logic, and scheduling windows'}
            {activeSection === 'moderation' && 'Content screening and blocking rules'}
            {activeSection === 'limits' && 'Per-plan limits on series and generation'}
            {activeSection === 'notifications' && 'Email and in-app notification preferences'}
            {activeSection === 'branding' && 'Platform name, tagline, and maintenance mode'}
            {activeSection === 'analytics' && 'Analytics retention and demo data settings'}
            {activeSection === 'payments' && 'UPI, Razorpay, Stripe, Cashfree — configure payment gateway and UPI ID'}
            {activeSection === 'payment-behavior' && 'Payment expiry, auto-activation, retry, and receipt settings'}
            {activeSection === 'subscription' && 'Subscription expiry, grace period, and renewal reminders'}
            {activeSection === 'tax' && 'GST, tax compliance, and invoice numbering'}
            {activeSection === 'connections' && 'View all connected social accounts across users'}
            {activeSection === 'database' && 'Table row counts and data management'}
            {activeSection === 'ai-studio' && 'Generate videos and images directly'}
            {activeSection === 'sql-editor' && 'Write, approve, and execute SQL queries safely'}
            {activeSection === 'users' && 'Manage users, plans, and admin roles'}
          </p>
        </div>

        {renderSection()}
      </div>
    </div>
  );
}

// ── AI Providers Panel ─────────────────────────────────────────────────────
function AiProvidersPanel() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    provider: 'openai' as string,
    api_key: '',
    base_url: '',
    models: '' as string,
    is_active: true,
    priority: 0,
    use_for: ['script', 'llm', 'image'] as string[],
  });

  const providerOptions = [
    { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com', placeholder: 'sk-...' },
    { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com', placeholder: 'sk-ant-...' },
    { value: 'google', label: 'Google AI', defaultUrl: 'https://generativelanguage.googleapis.com', placeholder: 'AIza...' },
    { value: 'mistral', label: 'Mistral', defaultUrl: 'https://api.mistral.ai', placeholder: 'mistral-...' },
    { value: 'nvidia_nim', label: 'NVIDIA NIM', defaultUrl: 'https://integrate.api.nvidia.com', placeholder: 'nvapi-...' },
    { value: 'ollama', label: 'Ollama (Local)', defaultUrl: 'http://localhost:11434', placeholder: 'N/A' },
    { value: 'cosmos', label: 'NVIDIA Cosmos (Local)', defaultUrl: 'http://localhost:8000', placeholder: 'NGC API key (optional)' },
    { value: 'custom', label: 'Custom', defaultUrl: '', placeholder: 'API key' },
  ];

  const modelSuggestions: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest'],
    ollama: ['llama3.1', 'mistral', 'codellama', 'gemma2'],
    cosmos: ['Cosmos3-Nano', 'Cosmos3-Super'],
    nvidia_nim: ['nvidia/llama-3.1-nemotron-70b-instruct', 'nvidia/cosmos-reason2-8b', 'deepseek-ai/deepseek-v4-flash'],
    custom: [],
  };

  const useForOptions = [
    { value: 'script', label: 'Script Gen' },
    { value: 'llm', label: 'General LLM' },
    { value: 'image', label: 'Image Gen' },
  ];

  const loadProviders = async () => {
    try {
      const { data, error } = await supabase.from('ai_providers').select('*').order('priority', { ascending: false });
      if (!error) setProviders(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProviders(); }, []);

  const resetForm = () => {
    setForm({ name: '', provider: 'openai', api_key: '', base_url: '', models: '', is_active: true, priority: 0, use_for: ['script', 'llm', 'image'] });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: any) => {
    setForm({
      name: p.name,
      provider: p.provider,
      api_key: p.api_key || '',
      base_url: p.base_url || '',
      models: Array.isArray(p.models) ? p.models.join(', ') : '',
      is_active: p.is_active,
      priority: p.priority,
      use_for: Array.isArray(p.use_for) ? p.use_for : ['script', 'llm', 'image'],
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.provider) return;
    setSaving(true);
    try {
      const modelsArr = form.models.split(',').map(m => m.trim()).filter(Boolean);
      const payload = {
        name: form.name,
        provider: form.provider,
        api_key: form.api_key || null,
        base_url: form.base_url || null,
        models: modelsArr,
        is_active: form.is_active,
        priority: form.priority,
        use_for: form.use_for,
      };
      if (editingId) {
        const { error } = await supabase.from('ai_providers').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ai_providers').insert({ ...payload, user_id: user?.id });
        if (error) throw error;
      }
      toast.success(editingId ? 'Provider updated' : 'Provider added');
      resetForm();
      loadProviders();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this provider?')) return;
    const { error } = await supabase.from('ai_providers').delete().eq('id', id);
    if (!error) { toast.success('Deleted'); loadProviders(); }
  };

  const handleTest = async (p: any) => {
    setTestingId(p.id);
    try {
      const model = Array.isArray(p.models) && p.models.length > 0 ? p.models[0] : '';
      const { data, error } = await supabase.functions.invoke('test-ai-provider', {
        body: { provider: p.provider, base_url: p.base_url || '', api_key: p.api_key || '', model },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Connected in ${data.latency_ms}ms`);
      } else {
        toast.error(data?.error || 'Connection failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const providerIcon = (p: string) => {
    switch (p) {
      case 'openai': return <Bot size={14} className="text-green-600" />;
      case 'anthropic': return <Bot size={14} className="text-orange-500" />;
      case 'google': return <Bot size={14} className="text-blue-500" />;
      case 'mistral': return <Bot size={14} className="text-purple-500" />;
      case 'ollama': return <Server size={14} className="text-teal-500" />;
      case 'cosmos': return <Bot size={14} className="text-emerald-500" />;
      case 'nvidia_nim': return <Bot size={14} className="text-green-600" />;
      default: return <Globe size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <Server size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">AI Providers</h3>
            <p className="text-xs text-muted-foreground">Manage API keys and model configurations</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Bot size={13} className="mr-1.5" /> Add Provider
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border border-border shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold">{editingId ? 'Edit Provider' : 'Add Provider'}</h4>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-semibold">Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My OpenAI Key" className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[10px] font-semibold">Provider</Label>
                <select value={form.provider} onChange={e => {
                  const p = e.target.value;
                  setForm(f => ({ ...f, provider: p, base_url: providerOptions.find(o => o.value === p)?.defaultUrl || '' }));
                }} className="w-full h-8 text-xs mt-1 border border-border rounded-md px-2 bg-background">
                  {providerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[10px] font-semibold">API Key</Label>
                <Input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder={providerOptions.find(o => o.value === form.provider)?.placeholder} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[10px] font-semibold">Base URL</Label>
                <Input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://api.openai.com" className="h-8 text-xs mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px] font-semibold">Models (comma-separated)</Label>
                <Input value={form.models} onChange={e => setForm(f => ({ ...f, models: e.target.value }))} placeholder={modelSuggestions[form.provider]?.join(', ') || 'model-id'} className="h-8 text-xs mt-1" />
                {modelSuggestions[form.provider]?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {modelSuggestions[form.provider].map(m => (
                      <button key={m} onClick={() => setForm(f => ({ ...f, models: f.models ? `${f.models}, ${m}` : m }))}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                        + {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-[10px] font-semibold">Priority</Label>
                <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[10px] font-semibold">Use For</Label>
                <div className="flex gap-2 mt-1">
                  {useForOptions.map(u => (
                    <button key={u.value}
                      onClick={() => setForm(f => ({
                        ...f,
                        use_for: f.use_for.includes(u.value) ? f.use_for.filter(x => x !== u.value) : [...f.use_for, u.value],
                      }))}
                      className={cn('text-[10px] px-2 py-1 rounded-md border transition-colors',
                        form.use_for.includes(u.value) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                      )}>
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-semibold">Active</Label>
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving || !form.name}>
                {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
                {editingId ? 'Update' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider List */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : providers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot size={20} className="text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No AI providers configured</p>
              <p className="text-[10px] text-muted-foreground mt-1">Add an API key to start using external AI models</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {providers.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {providerIcon(p.provider)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{p.name}</span>
                      <Badge className={cn('text-[9px] font-bold border-0',
                        p.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-muted text-muted-foreground'
                      )}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge className="text-[9px] font-bold border-0 bg-muted text-muted-foreground capitalize">{p.provider}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {Array.isArray(p.models) ? p.models.join(', ') : 'No models'}
                      </span>
                      {Array.isArray(p.use_for) && p.use_for.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          · {p.use_for.join(', ')}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">· Priority: {p.priority}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => handleTest(p)} disabled={testingId === p.id}>
                      {testingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                      Test
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => startEdit(p)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 size={11} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── AI Usage Panel ──────────────────────────────────────────────────────────
function AiUsagePanel() {
  const [stats, setStats] = useState<{
    totalCalls: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
    avgLatencyMs: number;
    byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
    byUseCase: Record<string, { calls: number; tokens: number; cost: number }>;
  } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([
          Promise.resolve(supabase.rpc('1')).then(() => null).catch(() => null), // fallback
          supabase.from('ai_usage').select('*').gte('created_at', new Date(Date.now() - days * 86400000).toISOString()).order('created_at', { ascending: false }).limit(50),
        ]);
        // Compute stats client-side
        const records = (r.data ?? []) as any[];
        const byProvider: Record<string, { calls: number; tokens: number; cost: number }> = {};
        const byUseCase: Record<string, { calls: number; tokens: number; cost: number }> = {};
        let totalTokensIn = 0, totalTokensOut = 0, totalCost = 0, totalLatency = 0;

        for (const rec of records) {
          totalTokensIn += rec.tokens_in ?? 0;
          totalTokensOut += rec.tokens_out ?? 0;
          totalCost += rec.cost_estimate ?? 0;
          totalLatency += rec.latency_ms ?? 0;

          const p = rec.provider || 'unknown';
          if (!byProvider[p]) byProvider[p] = { calls: 0, tokens: 0, cost: 0 };
          byProvider[p].calls++;
          byProvider[p].tokens += (rec.tokens_in ?? 0) + (rec.tokens_out ?? 0);
          byProvider[p].cost += rec.cost_estimate ?? 0;

          const uc = rec.use_case || 'unknown';
          if (!byUseCase[uc]) byUseCase[uc] = { calls: 0, tokens: 0, cost: 0 };
          byUseCase[uc].calls++;
          byUseCase[uc].tokens += (rec.tokens_in ?? 0) + (rec.tokens_out ?? 0);
          byUseCase[uc].cost += rec.cost_estimate ?? 0;
        }

        setStats({
          totalCalls: records.length,
          totalTokensIn: records.reduce((s: number, r: any) => s + (r.tokens_in ?? 0), 0),
          totalTokensOut: records.reduce((s: number, r: any) => s + (r.tokens_out ?? 0), 0),
          totalCost: records.reduce((s: number, r: any) => s + (r.cost_estimate ?? 0), 0),
          avgLatencyMs: records.length > 0 ? Math.round(records.reduce((s: number, r: any) => s + (r.latency_ms ?? 0), 0) / records.length) : 0,
          byProvider,
          byUseCase,
        })
        setRecent(records);
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  const formatCost = (n: number) => n < 0.01 ? `<$0.01` : `$${n.toFixed(2)}`;
  const formatTokens = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <Activity size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">AI Usage</h3>
            <p className="text-xs text-muted-foreground">Monitor token consumption and costs</p>
          </div>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-background">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
      ) : !stats ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity size={20} className="text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No usage data yet</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Calls" value={stats.totalCalls} icon={<Activity size={14} />} color="bg-blue-50 text-blue-600" />
            <StatCard label="Tokens In" value={formatTokens(stats.totalTokensIn)} icon={<ArrowLeft size={14} />} color="bg-green-50 text-green-600" />
            <StatCard label="Tokens Out" value={formatTokens(stats.totalTokensOut)} icon={<TrendingUp size={14} />} color="bg-purple-50 text-purple-600" />
            <StatCard label="Est. Cost" value={formatCost(stats.totalCost)} icon={<CreditCard size={14} />} color="bg-amber-50 text-amber-600" />
            <StatCard label="Avg Latency" value={`${stats.avgLatencyMs}ms`} icon={<Zap size={14} />} color="bg-cyan-50 text-cyan-600" />
          </div>

          {/* By Provider */}
          {Object.keys(stats.byProvider).length > 0 && (
            <Card className="border border-border shadow-none">
              <CardContent className="p-4">
                <h4 className="text-xs font-bold mb-3">By Provider</h4>
                <div className="space-y-2">
                  {Object.entries(stats.byProvider).sort((a, b) => b[1].calls - a[1].calls).map(([provider, data]) => (
                    <div key={provider} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[9px] font-bold border-0 bg-muted capitalize">{provider}</Badge>
                        <span className="text-xs text-muted-foreground">{data.calls} calls</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatTokens(data.tokens)} tokens</span>
                        <span className="font-semibold">{formatCost(data.cost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* By Use Case */}
          {Object.keys(stats.byUseCase).length > 0 && (
            <Card className="border border-border shadow-none">
              <CardContent className="p-4">
                <h4 className="text-xs font-bold mb-3">By Use Case</h4>
                <div className="space-y-2">
                  {Object.entries(stats.byUseCase).sort((a, b) => b[1].calls - a[1].calls).map(([useCase, data]) => (
                    <div key={useCase} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[9px] font-bold border-0 bg-muted capitalize">{useCase}</Badge>
                        <span className="text-xs text-muted-foreground">{data.calls} calls</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatTokens(data.tokens)} tokens</span>
                        <span className="font-semibold">{formatCost(data.cost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Calls */}
          {recent.length > 0 && (
            <Card className="border border-border shadow-none">
              <CardContent className="p-0">
                <div className="px-4 pt-4 pb-2">
                  <h4 className="text-xs font-bold">Recent Calls</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {['Time', 'Provider', 'Model', 'Use Case', 'Tokens', 'Latency', 'Status'].map(h => (
                          <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-2 px-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.slice(0, 20).map((r: any) => (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-4 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="py-2 px-4"><Badge className="text-[8px] font-bold border-0 bg-muted capitalize">{r.provider}</Badge></td>
                          <td className="py-2 px-4 text-[10px] font-mono">{r.model}</td>
                          <td className="py-2 px-4 text-[10px] capitalize">{r.use_case}</td>
                          <td className="py-2 px-4 text-[10px]">{formatTokens((r.tokens_in ?? 0) + (r.tokens_out ?? 0))}</td>
                          <td className="py-2 px-4 text-[10px]">{r.latency_ms}ms</td>
                          <td className="py-2 px-4">
                            <Badge className={cn('text-[8px] font-bold border-0',
                              r.success ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            )}>
                              {r.success ? 'OK' : 'Error'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── SQL Editor Section (inline redirect) ───────────────────────────────────
function SqlEditorSection() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/admin/sql-editor', { replace: true });
  }, [navigate]);
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );
}

// ── Connections Panel (admin view) ──────────────────────────────────────────
function ConnectionsPanel() {
  const [conns, setConns] = useState<Array<{ id: string; platform: string; account_name: string; account_username: string; is_active: boolean; login_status: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('social_credentials')
        .select('id,platform,account_name,account_username,is_active,login_status,created_at')
        .order('created_at', { ascending: false });
      setConns((data ?? []) as never[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>;

  const platformIcon = (p: string) => {
    if (p === 'instagram') return <Instagram size={14} className="text-pink-500" />;
    if (p === 'youtube') return <Youtube size={14} className="text-red-500" />;
    return <Globe size={14} className="text-blue-600" />;
  };

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-0">
        {conns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Link2 size={20} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No connections yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['User', 'Platform', 'Account', 'Status', 'Connected'].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3 px-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conns.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-5 text-xs text-muted-foreground">{c.account_username || '—'}</td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-1.5">
                        {platformIcon(c.platform)}
                        <span className="text-xs font-semibold capitalize">{c.platform}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-xs font-medium">{c.account_name || c.account_username || '—'}</td>
                    <td className="py-3 px-5">
                      <Badge className={cn('text-[10px] font-bold border-0',
                        c.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-muted text-muted-foreground'
                      )}>
                        {c.is_active ? 'Active' : c.login_status || 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-5 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Database Panel (admin view) ─────────────────────────────────────────────
function DatabasePanel() {
  const [tables, setTables] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  const tableNames = ['profiles', 'series', 'videos', 'social_connections', 'social_credentials', 'analytics', 'scheduled_posts', 'notifications', 'platform_settings'];

  useEffect(() => {
    (async () => {
      const results = await Promise.all(
        tableNames.map(async name => {
          const { count } = await supabase.from(name).select('id', { count: 'exact', head: true });
          return { name, count: count ?? 0 };
        })
      );
      setTables(results);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Table', 'Row Count', 'Status'].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3 px-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tables.map(t => (
                <tr key={t.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-5">
                    <span className="text-sm font-bold font-mono">{t.name}</span>
                  </td>
                  <td className="py-3 px-5 text-sm font-bold">{formatNumber(t.count)}</td>
                  <td className="py-3 px-5">
                    <Badge className="text-[10px] font-bold border-0 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">Healthy</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
