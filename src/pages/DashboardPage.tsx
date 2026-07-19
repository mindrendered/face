import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { seriesApi, videosApi, connectionsApi, analyticsApi } from '@/services/api';
import type { Series, Video, SocialConnection } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Film, Zap, FolderOpen, Link2, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Loader2, Play, Download, Plus, ArrowRight
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  queued:             { label: 'Queued',           color: 'text-muted-foreground',  icon: <Clock size={12} /> },
  generating_script:  { label: 'Writing script',   color: 'text-primary',           icon: <Loader2 size={12} className="animate-spin" /> },
  generating_visuals: { label: 'Creating visuals', color: 'text-primary',           icon: <Loader2 size={12} className="animate-spin" /> },
  generating_video:   { label: 'Generating video', color: 'text-primary',           icon: <Loader2 size={12} className="animate-spin" /> },
  ready:              { label: 'Ready',             color: 'text-green-600',         icon: <CheckCircle2 size={12} /> },
  posted:             { label: 'Posted',            color: 'text-muted-foreground',  icon: <CheckCircle2 size={12} /> },
  failed:             { label: 'Failed',            color: 'text-destructive',       icon: <AlertCircle size={12} /> },
  scheduled:          { label: 'Scheduled',         color: 'text-primary',           icon: <Clock size={12} /> },
};

function VideoRow({ video }: { video: Video }) {
  const cfg = statusConfig[video.status] || statusConfig.queued;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="w-9 h-9 rounded-lg bg-muted shrink-0 flex items-center justify-center overflow-hidden">
        {video.thumbnail_url
          ? <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
          : <Film size={13} className="text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{video.title || 'Untitled video'}</p>
        <p className="text-xs text-muted-foreground truncate">
          {new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className={`flex items-center gap-1 text-xs shrink-0 ${cfg.color}`}>
        {cfg.icon}
        <span>{cfg.label}</span>
      </div>
      {video.status === 'ready' && video.video_url && (
        <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Download size={12} />
          </Button>
        </a>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [counts, setCounts] = useState({ total: 0, ready: 0, scheduled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        await analyticsApi.seedDemo(user.id);
        const [s, v, c, cnt] = await Promise.all([
          seriesApi.list(),
          videosApi.listRecent(8),
          connectionsApi.list(),
          videosApi.counts(),
        ]);
        setSeries(s);
        setRecentVideos(v);
        setConnections(c.filter(c => c.is_connected));
        setCounts(cnt);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const stats = [
    { label: 'Videos generated', value: counts.total,    icon: <Film size={18} className="text-primary" />,        bg: 'bg-primary/8' },
    { label: 'Ready to post',    value: counts.ready,     icon: <CheckCircle2 size={18} className="text-green-600" />, bg: 'bg-green-50' },
    { label: 'Scheduled',        value: counts.scheduled, icon: <Clock size={18} className="text-amber-500" />,      bg: 'bg-amber-50' },
    { label: 'Connected accounts', value: connections.length, icon: <Link2 size={18} className="text-violet-500" />, bg: 'bg-violet-50' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {firstName ? `Hey, ${firstName} 👋` : 'Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's happening with your content.</p>
        </div>
        <Button asChild size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold shrink-0">
          <Link to="/create-series"><Plus size={14} className="mr-1.5" />New series</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border border-border shadow-none card-hover">
            <CardContent className="pt-5 pb-4 px-5">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                {s.icon}
              </div>
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Series */}
        <Card className="border border-border shadow-none h-full flex flex-col">
          <CardHeader className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">Active series</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary">
                <Link to="/series"><FolderOpen size={12} />View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 flex-1">
            {series.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center">
                  <Film size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No series yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Create your first to start generating</p>
                </div>
                <Button asChild size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold">
                  <Link to="/create-series"><Zap size={12} className="mr-1.5" />Create series</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {series.slice(0, 4).map(s => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/series/${s.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/3 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <Play size={12} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.niche} · {s.language}</p>
                    </div>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                      {s.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Videos */}
        <Card className="border border-border shadow-none h-full flex flex-col">
          <CardHeader className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">Recent videos</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary">
                <Link to="/series"><Film size={12} />All videos</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 flex-1">
            {recentVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center">
                  <Film size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No videos yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a series to start generating content.</p>
                </div>
              </div>
            ) : (
              <div>
                {recentVideos.map(v => <VideoRow key={v.id} video={v} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connect CTA */}
      {connections.length === 0 && (
        <Card className="border border-primary/20 shadow-none" style={{ background: 'var(--gradient-card)' }}>
          <CardContent className="px-5 py-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Link2 size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">Connect your social accounts</p>
                <p className="text-xs text-muted-foreground">Link Instagram and YouTube to enable auto-posting.</p>
              </div>
            </div>
            <Button asChild size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold shrink-0">
              <Link to="/connections"><TrendingUp size={13} className="mr-1.5" />Connect accounts <ArrowRight size={12} className="ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
