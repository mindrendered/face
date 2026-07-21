import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Series } from '@/types/types';
import { seriesApi, connectionsApi } from '@/services/api';
import { trackConnectionAdded } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Instagram, Youtube, Loader2, CheckCircle2,
  AlertCircle, Trash2, Plus, Eye, EyeOff, LogIn, Facebook,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SocialCredential {
  id: string;
  platform: 'instagram' | 'youtube' | 'facebook';
  account_name: string | null;
  account_username: string | null;
  account_id: string | null;
  is_active: boolean;
  login_status: string;
  created_at: string;
}

const PLATFORM_META: Record<string, {
  icon: React.ReactNode;
  color: string;
  label: string;
  authType: 'credentials' | 'oauth';
  fields: Array<{ key: string; label: string; placeholder: string; type: string }>;
  helpText: string;
}> = {
  instagram: {
    icon: <Instagram size={16} />,
    color: 'text-pink-500',
    label: 'Instagram',
    authType: 'credentials',
    fields: [
      { key: 'username', label: 'Username', placeholder: 'your Instagram username', type: 'text' },
      { key: 'password', label: 'Password', placeholder: 'your Instagram password', type: 'password' },
    ],
    helpText: 'Sign in with your Instagram account to enable auto-posting.',
  },
  facebook: {
    icon: <Facebook size={16} />,
    color: 'text-blue-600',
    label: 'Facebook',
    authType: 'credentials',
    fields: [
      { key: 'username', label: 'Email or Phone', placeholder: 'your Facebook email or phone', type: 'text' },
      { key: 'password', label: 'Password', placeholder: 'your Facebook password', type: 'password' },
    ],
    helpText: 'Sign in with your Facebook account to enable auto-posting to Pages and Groups.',
  },
  youtube: {
    icon: <Youtube size={16} />,
    color: 'text-red-500',
    label: 'YouTube',
    authType: 'oauth',
    fields: [
      { key: 'app_id', label: 'Client ID', placeholder: 'OAuth 2.0 Client ID', type: 'text' },
      { key: 'access_token', label: 'Access Token', placeholder: 'OAuth access token', type: 'password' },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: 'OAuth refresh token', type: 'password' },
      { key: 'account_name', label: 'Channel Name', placeholder: 'e.g. My YouTube Channel', type: 'text' },
    ],
    helpText: 'Create OAuth 2.0 credentials in Google Cloud Console.',
  },
};

// ── Login Connect Modal (Instagram / Facebook) ─────────────────────────────
function LoginConnectModal({ platform, onConnected }: { platform: 'instagram' | 'facebook'; onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = PLATFORM_META[platform];

  const handleLogin = async () => {
    if (!username.trim()) { toast.error('Username is required'); return; }
    if (!password.trim()) { toast.error('Password is required'); return; }

    setSaving(true);
    try {
      const result = await connectionsApi.socialLogin({
        platform,
        username: username.trim(),
        password,
      });

      if (!result.success) {
        if (result.status === 'challenge_required') {
          toast.error('Account requires verification. Please check your email or SMS for a code, then try again.');
        } else if (result.status === 'invalid_credentials') {
          toast.error('Invalid username or password. Please check your credentials.');
        } else {
          toast.error(result.error || 'Login failed');
        }
        return;
      }

      toast.success(`${meta.label} connected as @${result.data?.account_username || username}`);
      trackConnectionAdded(platform);
      setOpen(false);
      setUsername('');
      setPassword('');
      onConnected();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gradient-bg border-0 text-white font-semibold">
          <Plus size={12} className="mr-1.5" />Connect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={meta.color}>{meta.icon}</span>
            Connect {meta.label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Simple login explanation */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-start gap-2.5">
            <LogIn size={14} className="text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              {meta.helpText}
            </div>
          </div>

          {/* Username field */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{meta.fields[0].label}</Label>
            <Input
              type="text"
              placeholder={meta.fields[0].placeholder}
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="h-10 text-sm px-3"
              autoFocus
            />
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{meta.fields[1].label}</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={meta.fields[1].placeholder}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-10 text-sm px-3 pr-10"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-9 font-semibold">Cancel</Button>
            <Button size="sm" className="h-9 gradient-bg border-0 text-white font-semibold" onClick={handleLogin} disabled={saving}>
              {saving ? <><Loader2 size={12} className="mr-1.5 animate-spin" />Connecting…</> : 'Connect account'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── OAuth Connect Modal (YouTube) ──────────────────────────────────────────
function OAuthConnectModal({ platform, onConnected }: { platform: 'youtube'; onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const meta = PLATFORM_META[platform];

  const handleSave = async () => {
    if (!form.app_id?.trim()) { toast.error('Client ID is required'); return; }
    if (!form.access_token?.trim()) { toast.error('Access Token is required'); return; }
    setSaving(true);
    try {
      // Fetch the actual YouTube channel ID from the API
      let channelId = form.app_id || '';
      let channelName = form.account_name || '';
      try {
        const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
          headers: { Authorization: `Bearer ${form.access_token}` },
        });
        const data = await res.json();
        if (data.items?.length > 0) {
          channelId = data.items[0].id;
          channelName = channelName || data.items[0].snippet?.title || '';
        }
      } catch {
        // If YouTube API call fails, fall back to Client ID (user can update later)
      }

      await connectionsApi.upsert({
        platform: 'youtube',
        account_name: channelName,
        account_id: channelId,
        access_token: form.access_token || null,
        refresh_token: form.refresh_token || null,
        is_connected: true,
      });
      toast.success('YouTube connected successfully');
      trackConnectionAdded('youtube');
      setOpen(false);
      setForm({});
      onConnected();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({}); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gradient-bg border-0 text-white font-semibold">
          <Plus size={12} className="mr-1.5" />Connect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={meta.color}>{meta.icon}</span>
            Connect {meta.label} Account
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {meta.fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs font-semibold">{field.label}</Label>
              <div className="relative">
                <Input
                  type={field.type === 'password' && !showSecret[field.key] ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="h-10 text-sm px-3 pr-10"
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowSecret(p => ({ ...p, [field.key]: !p[field.key] }))}
                  >
                    {showSecret[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-9 font-semibold">Cancel</Button>
            <Button size="sm" className="h-9 gradient-bg border-0 text-white font-semibold" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={12} className="mr-1.5 animate-spin" />Saving…</> : 'Connect account'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Connect Button (dispatches to the right modal) ─────────────────────────
function ConnectButton({ platform, onConnected }: { platform: 'instagram' | 'facebook' | 'youtube'; onConnected: () => void }) {
  const meta = PLATFORM_META[platform];
  if (meta.authType === 'credentials') {
    return <LoginConnectModal platform={platform as 'instagram' | 'facebook'} onConnected={onConnected} />;
  }
  return <OAuthConnectModal platform={platform as 'youtube'} onConnected={onConnected} />;
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ConnectionsPage() {
  const [credentials, setCredentials] = useState<SocialCredential[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [creds, s] = await Promise.all([
        connectionsApi.listCredentials(),
        seriesApi.list(),
      ]);
      setCredentials(creds as SocialCredential[]);
      setSeries(s.filter(x => x.status !== 'archived'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const disconnect = async (id: string) => {
    try {
      const cred = credentials.find(c => c.id === id);
      await connectionsApi.disconnect(id);

      // Unlink from any series that reference this credential
      if (cred) {
        const field = cred.platform === 'instagram' ? 'instagram_account_id' : 'youtube_account_id';
        const linkedSeries = series.filter(s => (s as Record<string, unknown>)[field] === id);
        await Promise.all(linkedSeries.map(s =>
          seriesApi.update(s.id, { [field]: null, auto_posting_enabled: false })
        ));
        setSeries(prev => prev.map(s =>
          linkedSeries.find(ls => ls.id === s.id)
            ? { ...s, [field]: null, auto_posting_enabled: false }
            : s
        ));
      }

      toast.success('Account disconnected');
      setCredentials(prev => prev.map(c => c.id === id ? { ...c, is_active: false } : c));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const remove = async (id: string) => {
    try {
      await connectionsApi.delete(id);
      toast.success('Account removed');
      setCredentials(prev => prev.filter(c => c.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  const linkToSeries = async (seriesId: string, platform: string, credId: string) => {
    const fieldMap: Record<string, string> = {
      instagram: 'instagram_account_id',
      youtube: 'youtube_account_id',
    };
    const field = fieldMap[platform] || 'youtube_account_id';
    await seriesApi.update(seriesId, { [field]: credId });
    setSeries(prev => prev.map(s => s.id === seriesId ? { ...s, [field]: credId } : s));
    toast.success('Account linked to series');
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  const platforms = ['instagram', 'facebook', 'youtube'] as const;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect your social accounts to enable auto-posting. Instagram and Facebook use your regular login — no developer setup needed.</p>
      </div>

      {/* Connect platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map(platform => {
          const meta = PLATFORM_META[platform];
          const cred = credentials.find(c => c.platform === platform);
          return (
            <Card key={platform} className={cn(
              'border-2 shadow-none transition-all',
              cred?.is_active ? 'border-primary/30 bg-primary/2' : 'border-border'
            )}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    cred?.is_active ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <span className={cn('scale-125', meta.color)}>{meta.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{meta.label}</p>
                    {cred?.is_active
                      ? <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-0.5 font-semibold">
                          <CheckCircle2 size={10} />
                          {cred.account_name || cred.account_username || 'Connected'}
                        </p>
                      : <p className="text-xs text-muted-foreground mt-0.5">Not connected</p>
                    }
                  </div>
                  {cred?.is_active
                    ? <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 font-bold shrink-0">Active</Badge>
                    : <ConnectButton platform={platform} onConnected={load} />
                  }
                </div>

                {cred?.is_active && (
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <ConnectButton platform={platform} onConnected={load} />
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground font-semibold" onClick={() => disconnect(cred.id)}>
                      Disconnect
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive font-semibold ml-auto" onClick={() => remove(cred.id)}>
                      <Trash2 size={12} className="mr-1" />Remove
                    </Button>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {meta.helpText}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* All credentials */}
      {credentials.length > 0 && (
        <Card className="border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle className="text-sm font-bold">Connected accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {credentials.map(cred => {
              const meta = PLATFORM_META[cred.platform];
              return (
                <div key={cred.id} className="flex items-center gap-3 py-3.5 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <span className={meta?.color}>{meta?.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{cred.account_name || cred.account_username || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{cred.platform}</p>
                  </div>
                  {cred.is_active
                    ? <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 font-bold shrink-0 flex items-center gap-1"><CheckCircle2 size={10} />Active</Badge>
                    : <Badge variant="secondary" className="text-[10px] shrink-0 flex items-center gap-1"><AlertCircle size={10} />Disconnected</Badge>
                  }
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Link to series */}
      {credentials.some(c => c.is_active) && series.length > 0 && (
        <Card className="border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle className="text-sm font-bold">Link accounts to series</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Choose which account posts to each of your series.</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">
            {series.map(s => (
              <div key={s.id} className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-sm font-bold">{s.name}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(['instagram', 'youtube'] as const).map(platform => {
                    const platformCreds = credentials.filter(c => c.platform === platform && c.is_active);
                    if (platformCreds.length === 0) return null;
                    const field = platform === 'instagram' ? 'instagram_account_id' : 'youtube_account_id';
                    return (
                      <div key={platform}>
                        <p className="text-xs font-semibold text-muted-foreground capitalize mb-1.5">{PLATFORM_META[platform].label}</p>
                        <Select
                          value={(s[field as keyof Series] as string | null) || 'none'}
                          onValueChange={val => val !== 'none' && linkToSeries(s.id, platform, val)}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not linked</SelectItem>
                            {platformCreds.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.account_name || c.account_username || 'Unnamed'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
