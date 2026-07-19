import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Settings, Users, CreditCard, Shield, Save, RefreshCw,
  Bot, Clock, Bell, Globe, Database, AlertTriangle, Palette,
  BarChart3, Link, Server, Eye, EyeOff, Trash2, UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// ── Setting Groups ──────────────────────────────────────────────────────────
const SETTING_GROUPS = {
  ai: { label: 'AI Generation', icon: <Bot size={14} />, keys: ['ai_script_model', 'ai_script_max_tokens', 'ai_video_provider', 'ai_video_max_duration', 'ai_image_provider'] },
  posting: { label: 'Auto-Posting', icon: <Clock size={14} />, keys: ['auto_post_enabled', 'post_retry_max', 'post_retry_delay_minutes', 'posting_window_start', 'posting_window_end'] },
  moderation: { label: 'Content Moderation', icon: <AlertTriangle size={14} />, keys: ['content_moderation_enabled', 'max_script_length', 'blocked_niches'] },
  limits: { label: 'Plan Limits', icon: <CreditCard size={14} />, keys: ['max_series_per_user_beginner', 'max_series_per_user_daily', 'max_series_per_user_pro'] },
  notifications: { label: 'Notifications', icon: <Bell size={14} />, keys: ['email_notifications_enabled', 'notify_on_video_ready', 'notify_on_post_fail', 'notify_on_plan_limit'] },
  branding: { label: 'Branding', icon: <Palette size={14} />, keys: ['platform_name', 'platform_tagline', 'support_email', 'maintenance_mode'] },
  analytics: { label: 'Analytics', icon: <BarChart3 size={14} />, keys: ['analytics_retention_days', 'demo_data_enabled'] },
} as const;

function isBoolSetting(value: unknown): boolean {
  return value === true || value === false || value === 'true' || value === 'false';
}

function getBoolValue(value: unknown): boolean {
  return value === true || value === 'true';
}

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlansConfig | null>(null);
  const [editedPlans, setEditedPlans] = useState<PlansConfig | null>(null);
  const [activeTab, setActiveTab] = useState('plans');
  const [searchQuery, setSearchQuery] = useState('');

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
    setUsers((data ?? []) as UserRow[]);
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
      toast.success(`${key} saved`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleAdmin = async (userId: string, current: boolean) => {
    const { error } = await supabase.rpc('toggle_user_admin', {
      target_user_id: userId,
      new_admin_status: !current,
    });
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

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) { toast.error('Delete failed'); return; }
    setUsers(prev => prev.filter(u => u.id !== userId));
    toast.success('User deleted');
  };

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (!isAdmin) return null;

  const planKeys = ['beginner', 'daily', 'pro'] as const;
  const filteredUsers = searchQuery
    ? users.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shrink-0">
          <Shield size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Super Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage platform settings, users, plans, AI config, and more.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="gradient-bg border-0 text-white text-xs font-bold">
            <Server size={10} className="mr-1" />Admin
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto p-1 bg-muted/50 flex flex-wrap">
          <TabsTrigger value="plans" className="text-xs font-semibold gap-1.5"><CreditCard size={12} />Plans</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs font-semibold gap-1.5"><Bot size={12} />AI Config</TabsTrigger>
          <TabsTrigger value="posting" className="text-xs font-semibold gap-1.5"><Clock size={12} />Posting</TabsTrigger>
          <TabsTrigger value="moderation" className="text-xs font-semibold gap-1.5"><AlertTriangle size={12} />Moderation</TabsTrigger>
          <TabsTrigger value="limits" className="text-xs font-semibold gap-1.5"><CreditCard size={12} />Limits</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs font-semibold gap-1.5"><Bell size={12} />Notifs</TabsTrigger>
          <TabsTrigger value="branding" className="text-xs font-semibold gap-1.5"><Palette size={12} />Branding</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs font-semibold gap-1.5"><BarChart3 size={12} />Analytics</TabsTrigger>
          <TabsTrigger value="users" className="text-xs font-semibold gap-1.5"><Users size={12} />Users ({users.length})</TabsTrigger>
        </TabsList>

        {/* ── Plans Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="plans" className="mt-4">
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
                    <CreditCard size={14} className="text-primary" />
                  </div>
                  Subscription Plans
                </CardTitle>
                <Button size="sm" className="h-9 text-xs gradient-bg border-0 text-white font-semibold" onClick={savePlans} disabled={savingKey === 'plans'}>
                  {savingKey === 'plans' ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Save size={12} className="mr-1.5" />}
                  Save plans
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {loadingSettings ? (
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              ) : editedPlans ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {planKeys.map(planKey => (
                    <div key={planKey} className="rounded-xl border-2 border-border p-4 space-y-3 hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold capitalize">{planKey}</p>
                        <Badge variant="outline" className="text-[10px]">{editedPlans[planKey].videos_per_month} vids/mo</Badge>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Price ($/month)</Label>
                          <Input type="number" min="0" value={editedPlans[planKey].price}
                            onChange={e => setEditedPlans(p => p ? { ...p, [planKey]: { ...p[planKey], price: parseInt(e.target.value) || 0 } } : p)}
                            className="h-9 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Videos/month</Label>
                          <Input type="number" min="1" value={editedPlans[planKey].videos_per_month}
                            onChange={e => setEditedPlans(p => p ? { ...p, [planKey]: { ...p[planKey], videos_per_month: parseInt(e.target.value) || 1 } } : p)}
                            className="h-9 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Frequency</Label>
                          <Input value={editedPlans[planKey].frequency}
                            onChange={e => setEditedPlans(p => p ? { ...p, [planKey]: { ...p[planKey], frequency: e.target.value } } : p)}
                            className="h-9 text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No plan data found. Save default plans first.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Generic Settings Tabs ─────────────────────────────────────────── */}
        {(['ai', 'posting', 'moderation', 'limits', 'notifications', 'branding', 'analytics'] as const).map(groupKey => {
          const group = SETTING_GROUPS[groupKey];
          const groupSettings = settings.filter(s => group.keys.includes(s.key));
          return (
            <TabsContent key={groupKey} value={groupKey} className="mt-4">
              <Card className="border border-border shadow-none">
                <CardHeader className="px-5 pt-5 pb-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
                      <span className="text-primary">{group.icon}</span>
                    </div>
                    {group.label} Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-1">
                  {loadingSettings ? (
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  ) : groupSettings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No settings found for this group.</p>
                  ) : (
                    groupSettings.map(setting => (
                      <div key={setting.key} className="flex items-center gap-4 py-3.5 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold font-mono">{setting.key}</p>
                          {setting.description && <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>}
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
                                try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                                if (String(parsed) !== String(setting.value)) {
                                  updateSetting(setting.key, parsed);
                                }
                              }}
                              className="h-9 w-48 text-xs px-3"
                            />
                          )}
                          {savingKey === setting.key && <Loader2 size={12} className="animate-spin text-primary" />}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* ── Users Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="users" className="mt-4">
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
                    <Users size={14} className="text-primary" />
                  </div>
                  User Management
                  <Badge className="ml-1 text-[10px] gradient-bg border-0 text-white font-bold">{filteredUsers.length}</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-9 w-48 text-xs"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 border border-border" onClick={loadUsers} aria-label="Refresh users">
                    <RefreshCw size={13} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {loadingUsers ? (
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border">
                        {['User', 'Plan', 'Videos', 'Role', 'Joined', 'Actions'].map(h => (
                          <th key={h} className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wider py-3 pr-4 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4">
                            <div>
                              <p className="text-sm font-medium truncate max-w-[200px]">{u.email}</p>
                              {u.full_name && <p className="text-xs text-muted-foreground">{u.full_name}</p>}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <select
                              value={u.plan}
                              onChange={e => changePlan(u.id, e.target.value)}
                              className="text-xs border-2 border-border rounded-lg px-2 py-1.5 bg-background font-semibold hover:border-primary/40 transition-colors"
                            >
                              <option value="beginner">Beginner</option>
                              <option value="daily">Daily</option>
                              <option value="pro">Pro</option>
                            </select>
                          </td>
                          <td className="py-3 pr-4 text-sm font-bold whitespace-nowrap">{u.videos_generated_count}</td>
                          <td className="py-3 pr-4">
                            <Badge
                              className={cn(
                                'text-[10px] cursor-pointer font-bold border-0',
                                u.is_admin ? 'gradient-bg text-white' : 'bg-muted text-muted-foreground'
                              )}
                              onClick={() => toggleAdmin(u.id, u.is_admin)}
                            >
                              {u.is_admin ? 'Admin' : 'User'}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap font-medium">
                            {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold" onClick={() => toggleAdmin(u.id, u.is_admin)}>
                                {u.is_admin ? 'Revoke' : 'Make admin'}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive font-semibold" onClick={() => deleteUser(u.id)}>
                                <Trash2 size={11} />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
