import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { seriesApi, videosApi } from '@/services/api';
import type { Series, Video } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2, Film, Plus, Zap, Clock, CheckCircle2, AlertCircle,
  Pause, Archive, MoreVertical, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusConfig: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  paused:   { label: 'Paused',   color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  archived: { label: 'Archived', color: 'bg-muted text-muted-foreground border-border' },
};

const videoStatusCounts = (videos: Video[]) => {
  const counts = { total: videos.length, ready: 0, generating: 0, failed: 0, posted: 0 };
  for (const v of videos) {
    if (v.status === 'ready') counts.ready++;
    else if (['generating_script', 'generating_visuals', 'generating_video', 'queued'].includes(v.status)) counts.generating++;
    else if (v.status === 'failed') counts.failed++;
    else if (v.status === 'posted') counts.posted++;
  }
  return counts;
};

export default function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [videoCounts, setVideoCounts] = useState<Record<string, { total: number; ready: number; generating: number; failed: number; posted: number }>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const allSeries = await seriesApi.list();
      setSeries(allSeries);
      const counts: Record<string, ReturnType<typeof videoStatusCounts>> = {};
      await Promise.all(
        allSeries.map(async (s) => {
          const videos = await videosApi.listBySeries(s.id);
          counts[s.id] = videoStatusCounts(videos);
        })
      );
      setVideoCounts(counts);
    } catch {
      toast.error('Failed to load series');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await seriesApi.delete(deleteTarget.id);
      setSeries(prev => prev.filter(s => s.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.name}" archived`);
    } catch {
      toast.error('Failed to archive series');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeSeries = series.filter(s => s.status === 'active');
  const otherSeries = series.filter(s => s.status !== 'active');

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Series</h1>
          <p className="text-sm text-muted-foreground mt-1">{series.length} series total</p>
        </div>
        <Button asChild size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold shrink-0">
          <Link to="/create-series"><Plus size={14} className="mr-1.5" />New series</Link>
        </Button>
      </div>

      {/* Empty state */}
      {series.length === 0 && (
        <Card className="border border-border shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/8 flex items-center justify-center">
              <Film size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">No series yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first series to start generating content</p>
            </div>
            <Button asChild size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold">
              <Link to="/create-series"><Zap size={12} className="mr-1.5" />Create series</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active series */}
      {activeSeries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active</h2>
          <div className="grid gap-4">
            {activeSeries.map(s => (
              <SeriesCard
                key={s.id}
                series={s}
                counts={videoCounts[s.id]}
                onDelete={() => setDeleteTarget(s)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other series */}
      {otherSeries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paused / Archived</h2>
          <div className="grid gap-4">
            {otherSeries.map(s => (
              <SeriesCard
                key={s.id}
                series={s}
                counts={videoCounts[s.id]}
                onDelete={() => setDeleteTarget(s)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive series?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive "{deleteTarget?.name}". The series and its videos will be hidden from active views.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Series Card ──────────────────────────────────────────────────────────────
function SeriesCard({ series, counts, onDelete }: {
  series: Series;
  counts?: { total: number; ready: number; generating: number; failed: number; posted: number };
  onDelete: () => void;
}) {
  const status = statusConfig[series.status] || statusConfig.active;
  const c = counts || { total: 0, ready: 0, generating: 0, failed: 0, posted: 0 };

  return (
    <Card className="border border-border shadow-none card-hover">
      <CardContent className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/series/${series.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <h3 className="text-sm font-bold truncate">{series.name}</h3>
              <Badge variant="outline" className={cn('text-[10px] font-semibold border shrink-0', status.color)}>
                {status.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{series.niche}</span>
              <span>·</span>
              <span>{series.language}</span>
              <span>·</span>
              <span>{series.posting_frequency === '3x_week' ? '3x/week' : series.posting_frequency}</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {/* Video counts */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              {c.generating > 0 && (
                <span className="flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin text-primary" />
                  {c.generating}
                </span>
              )}
              {c.ready > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={10} className="text-green-600" />
                  {c.ready}
                </span>
              )}
              {c.failed > 0 && (
                <span className="flex items-center gap-1">
                  <AlertCircle size={10} className="text-destructive" />
                  {c.failed}
                </span>
              )}
              {c.posted > 0 && (
                <span className="flex items-center gap-1">
                  <Film size={10} />
                  {c.posted}
                </span>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/series/${series.id}`}>View details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 size={12} className="mr-2" />Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
