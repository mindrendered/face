import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useGeneration } from '@/contexts/GenerationContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, Film, FolderOpen, Link2, Calendar, BarChart2,
  Settings, Menu, LogOut, Zap, Bell, Shield, Loader2, Wand2
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard',     path: '/dashboard',     icon: LayoutDashboard },
  { label: 'Create Series', path: '/create-series', icon: Zap },
  { label: 'My Series',     path: '/series',         icon: FolderOpen },
  { label: 'AI Studio',     path: '/studio',         icon: Wand2 },
  { label: 'Connections',   path: '/connections',    icon: Link2 },
  { label: 'Schedule',      path: '/schedule',       icon: Calendar },
  { label: 'Analytics',     path: '/analytics',      icon: BarChart2 },
  { label: 'Settings',      path: '/settings',       icon: Settings },
];

function NavLink({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) {
  const location = useLocation();
  const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        'nav-active-bar flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 min-h-11',
        active
          ? 'bg-primary/8 text-primary font-semibold'
          : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
      )}
    >
      <Icon size={15} className="shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { signOut, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    onClose?.();
  };

  const initials = ((profile?.full_name || profile?.email || 'U')[0]).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-sm shrink-0">
            <Film size={15} className="text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">AutoReel</span>
        </div>
      </div>

      {/* User chip */}
      {profile && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-sidebar-accent">
            <div className="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{profile.full_name || 'Creator'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/30 bg-primary/5 rounded px-1.5 py-0.5 shrink-0">
              {profile.plan}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.path} item={item} onClick={onClose} />
        ))}
        {isAdmin && (
          <NavLink item={{ label: 'Admin', path: '/admin', icon: Shield }} onClick={onClose} />
        )}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut size={15} className="shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile } = useAuth();
  const { activeCount, jobs } = useGeneration();
  const navigate = useNavigate();
  const location = useLocation();

  const allNavItems = [...navItems, { label: 'Admin', path: '/admin', icon: Shield }];
  const currentPage = allNavItems.find(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/'));

  const activeJob = jobs.find(j => j.status === 'generating');

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-sidebar">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-background/95 backdrop-blur-sm sticky top-0 z-30">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0 h-8 w-8" aria-label="Open menu">
                <Menu size={16} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-60 bg-sidebar">
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <span className="text-sm font-bold flex-1 min-w-0 truncate tracking-tight">
            {currentPage?.label ?? 'AutoReel'}
          </span>

          {/* Active generation pill */}
          {activeCount > 0 && activeJob && (
            <Link
              to="/series"
              className="hidden md:flex items-center gap-1.5 text-xs text-primary border border-primary/20 bg-primary/5 rounded-full px-3 py-1 hover:bg-primary/10 transition-colors shrink-0 font-medium"
            >
              <Loader2 size={10} className="animate-spin" />
              <span>{activeJob.seriesName}</span>
              <span className="text-primary/60">— {activeJob.stage}</span>
            </Link>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost" size="icon"
              onClick={() => navigate('/dashboard')}
              className="relative h-8 w-8"
              aria-label="Notifications"
            >
              <Bell size={15} />
            </Button>
            {profile && (
              <div
                className="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-xs font-bold text-white cursor-pointer"
                onClick={() => navigate('/settings')}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/settings'); }}
                role="button"
                tabIndex={0}
                aria-label="Go to settings"
              >
                {((profile.full_name || profile.email || 'U')[0]).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
