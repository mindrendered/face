import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Settings, Users, CreditCard, Shield, Save, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AIStudio } from '@/components/AIStudio';

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

interface PlatformSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

interface UserRow {
  id: string;
  email: string;
  plan: string;
  is_admin: boolean;
  videos_generated_count: number;
  created_at: string;
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
      .select('id, email, plan, is_admin, videos_generated_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
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
      toast.success('Setting saved');
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

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (!isAdmin) return null;

  const planKeys = ['beginner', 'daily', 'pro'] as const;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shrink-0">
          <Shield size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Platform settings, pricing, and user management.</p>
        </div>
      </div>

      {/* AI Generation Studio */}
      <AIStudio />

      {/* Plan Pricing */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
                <CreditCard size={14} className="text-primary" />
              </div>
              Plan Pricing
            </CardTitle>
            <Button size="sm" className="h-9 text-xs gradient-bg border-0 text-white font-semibold" onClick={savePlans} disabled={savingKey === 'plans'}>
              {savingKey === 'plans' ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Save size={12} className="mr-1.5" />}
              Save changes
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
                  <p className="text-sm font-bold capitalize">{planKey}</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Price ($/month)</p>
                      <Input
                        type="number" min="0"
                        value={editedPlans[planKey].price}
                        onChange={e => setEditedPlans(p => p ? { ...p, [planKey]: { ...p[planKey], price: parseInt(e.target.value) || 0 } } : p)}
                        className="h-10 text-sm px-3"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Videos/month</p>
                      <Input
                        type="number" min="1"
                        value={editedPlans[planKey].videos_per_month}
                        onChange={e => setEditedPlans(p => p ? { ...p, [planKey]: { ...p[planKey], videos_per_month: parseInt(e.target.value) || 1 } } : p)}
                        className="h-10 text-sm px-3"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Frequency label</p>
                      <Input
                        value={editedPlans[planKey].frequency}
                        onChange={e => setEditedPlans(p => p ? { ...p, [planKey]: { ...p[planKey], frequency: e.target.value } } : p)}
                        className="h-10 text-sm px-3"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Other Settings */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
              <Settings size={14} className="text-primary" />
            </div>
            Platform Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-1">
          {settings.filter(s => s.key !== 'plans' && s.key !== 'supported_languages').map(setting => (
            <div key={setting.key} className="flex items-center gap-4 py-3.5 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold font-mono">{setting.key}</p>
                {setting.description && <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  defaultValue={String(setting.value)}
                  onBlur={e => {
                    const raw = e.target.value;
                    let parsed: unknown = raw;
                    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                    if (String(parsed) !== String(setting.value)) {
                      updateSetting(setting.key, parsed);
                    }
                  }}
                  className="h-9 w-36 text-xs px-3"
                />
                {savingKey === setting.key && <Loader2 size={12} className="animate-spin text-primary" />}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Users */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
                <Users size={14} className="text-primary" />
              </div>
              Users <Badge className="ml-1 text-[10px] gradient-bg border-0 text-white font-bold">{users.length}</Badge>
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 border border-border" onClick={loadUsers} aria-label="Refresh users">
              <RefreshCw size={13} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {loadingUsers ? (
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    {['Email', 'Plan', 'Videos', 'Role', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wider py-3 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 text-sm font-medium truncate max-w-[180px]">{u.email}</td>
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
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold" onClick={() => toggleAdmin(u.id, u.is_admin)}>
                          {u.is_admin ? 'Revoke admin' : 'Make admin'}
                        </Button>
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
}
