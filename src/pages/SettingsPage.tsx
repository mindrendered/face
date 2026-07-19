import { useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, User, Shield, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? '');
  }, [profile]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shrink-0">
          <User size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
        </div>
      </div>

      {/* Profile */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
              <User size={14} className="text-primary" />
            </div>
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
            <Input value={profile.email} disabled className="h-10 text-sm bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Full name</Label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
              className="h-10 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="gradient-bg border-0 text-white font-semibold" onClick={saveProfile} disabled={saving}>
              {saving ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
              <CreditCard size={14} className="text-primary" />
            </div>
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-lg font-bold capitalize">{profile.plan}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {profile.plan === 'beginner' && '12 videos/month · 3× per week'}
                {profile.plan === 'daily' && '30 videos/month · Every day'}
                {profile.plan === 'pro' && '60 videos/month · Maximum output'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin badge */}
      {profile.is_admin && (
        <Card className="border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
                <Shield size={14} className="text-primary" />
              </div>
              Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-sm text-muted-foreground">You have admin privileges. Visit the <a href="/admin" className="text-primary hover:underline font-medium">Admin panel</a> to manage platform settings.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
