import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seriesApi } from '@/services/api';
import type { Series } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Plus, Loader2, Film, MoreHorizontal, Pause, Trash2, Zap } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await seriesApi.list();
      setSeries(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (s: Series) => {
    const next = s.status === 'active' ? 'paused' : 'active';
    await seriesApi.update(s.id, { status: next });
    setSeries(prev => prev.map(x => x.id === s.id ? { ...x, status: next } : x));
    toast.success(`Series ${next}`);
  };

  const deleteSeries = async (id: string) => {
    await seriesApi.delete(id);
    setSeries(prev => prev.filter(x => x.id !== id));
    toast.success('Series archived');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My series</h1>
          <p className="text-sm text-muted-foreground mt-1">{series.length} series total</p>
        </div>
        <Button asChild size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold shrink-0">
          <Link to="/create-series"><Plus size={14} className="mr-1.5" />New series</Link>
        </Button>
      </div>

      {series.length === 0 ? (
        <Card className="border border-border shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center">
              <Film size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-base font-bold">No series yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first series to start generating content.</p>
            </div>
            <Button asChild size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold">
              <Link to="/create-series"><Zap size={13} className="mr-1.5" />Create series</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {series.map(s => (
            <Card key={s.id} className={cn(
              'border shadow-none transition-all card-hover',
              s.status === 'active' ? 'border-primary/20' : 'border-border hover:border-foreground/20'
            )}>
              <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      s.status === 'active' ? 'gradient-bg' : 'bg-muted'
                    )}>
                      <Play size={13} className={s.status === 'active' ? 'text-white' : 'text-muted-foreground'} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.niche} · {s.language}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={s.status === 'active' ? 'default' : 'secondary'}
                      className={cn('text-[10px] font-semibold', s.status === 'active' && 'gradient-bg border-0 text-white')}
                    >
                      {s.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal size={13} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => navigate(`/series/${s.id}`)}>
                          <Film size={13} className="mr-2" /> View videos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(s)}>
                          {s.status === 'active'
                            ? <><Pause size={13} className="mr-2" /> Pause</>
                            : <><Play size={13} className="mr-2" /> Resume</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteSeries(s.id)} className="text-destructive">
                          <Trash2 size={13} className="mr-2" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Meta chips */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Style', value: s.visual_style },
                    { label: 'Voice', value: s.voice },
                    { label: 'Freq', value: s.posting_frequency === '3x_week' ? '3×/wk' : s.posting_frequency === 'daily' ? 'Daily' : 'Pro' },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg bg-muted/70 px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground capitalize">{item.label}</p>
                      <p className="text-xs font-semibold capitalize mt-0.5 truncate">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Auto-post:{' '}
                    <span className={s.auto_posting_enabled ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                      {s.auto_posting_enabled ? 'On' : 'Off'}
                    </span>
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-semibold" asChild>
                    <Link to={`/series/${s.id}`}>View videos</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
