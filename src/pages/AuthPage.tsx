import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Film, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const highlights = [
  'Fully faceless — no camera needed',
  'Auto-posts to Instagram & YouTube Shorts',
  'AI scripts, visuals, and voiceovers',
  '14-day money-back guarantee',
];

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'login' | 'register'>(searchParams.get('tab') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      if (tab === 'register') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        toast.success('Account created! Redirecting to your dashboard…');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel – branding */}
      <div className="hidden md:flex w-[440px] shrink-0 flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: 'var(--gradient-primary)' }}>
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 dot-pattern opacity-20 pointer-events-none" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
            <Film size={17} className="text-white" />
          </div>
          <span className="font-bold text-white text-base">AutoReel</span>
        </Link>
        <div className="relative">
          <p className="text-2xl font-bold leading-tight mb-4 text-white text-balance">
            Automate your content.<br />Grow on autopilot.
          </p>
          <p className="text-sm text-white/70 leading-relaxed mb-8">
            Pick a niche, set a style, and AutoReel generates and posts your videos to Instagram and YouTube Shorts — every single day.
          </p>
          <ul className="space-y-3">
            {highlights.map(h => (
              <li key={h} className="flex items-center gap-2.5 text-sm text-white/90">
                <CheckCircle size={14} className="text-white shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} AutoReel. All rights reserved.</p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--gradient-hero)' }}>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Film size={15} className="text-white" />
            </div>
            <span className="font-bold text-sm">AutoReel</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
                className="text-primary font-semibold hover:underline underline-offset-4"
              >
                {tab === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold">Full name</Label>
                <Input
                  id="name" type="text" placeholder="Your name"
                  value={name} onChange={e => setName(e.target.value)}
                  className="h-11 text-sm px-3"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="h-11 text-sm px-3"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
              <Input
                id="password" type="password" placeholder="••••••••" required
                value={password} onChange={e => setPassword(e.target.value)}
                minLength={8} className="h-11 text-sm px-3"
              />
              {tab === 'register' && (
                <p className="text-[11px] text-muted-foreground">Minimum 8 characters</p>
              )}
            </div>
            <Button type="submit" className="w-full h-11 gradient-bg border-0 text-white btn-glow font-semibold mt-2" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {tab === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {tab === 'login' ? 'Sign in' : 'Create free account'}
                  <ArrowRight size={15} />
                </span>
              )}
            </Button>
          </form>

          {tab === 'register' && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              By signing up, you agree to our terms. 14-day money-back guarantee.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
