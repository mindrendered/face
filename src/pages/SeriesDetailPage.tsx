import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { seriesApi, videosApi } from '@/services/api';
import { generationApi } from '@/services/generation';
import { useGeneration } from '@/contexts/GenerationContext';
import type { Series, Video } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Download, Loader2, Film, AlertCircle, CheckCircle2,
  Clock, ArrowLeft, Zap, RefreshCw, Play, X, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  queued:             { label: 'Queued',           variant: 'secondary',    icon: <Clock size={11} /> },
  generating_script:  { label: 'Writing script',   variant: 'default',      icon: <Loader2 size={11} className="animate-spin" /> },
  generating_visuals: { label: 'Creating visuals', variant: 'default',      icon: <Loader2 size={11} className="animate-spin" /> },
  generating_video:   { label: 'Generating video', variant: 'default',      icon: <Loader2 size={11} className="animate-spin" /> },
  ready:              { label: 'Ready',             variant: 'outline',      icon: <CheckCircle2 size={11} className="text-green-600" /> },
  posted:             { label: 'Posted',            variant: 'secondary',    icon: <CheckCircle2 size={11} /> },
  failed:             { label: 'Failed',            variant: 'destructive',  icon: <AlertCircle size={11} /> },
  scheduled:          { label: 'Scheduled',         variant: 'outline',      icon: <Clock size={11} /> },
};

// ── Video Preview Modal ──────────────────────────────────────────────────────
function VideoPreviewModal({ video, open, onClose }: { video: Video | null; open: boolean; onClose: () => void }) {
  if (!video) return null;
  const isGenerating = ['generating_script', 'generating_visuals', 'generating_video', 'queued'].includes(video.status);
  const progress = video.generation_progress ?? 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-3 pr-6">
            <DialogTitle className="text-sm font-medium flex-1 min-w-0 truncate">
              {video.title || 'Untitled video'}
            </DialogTitle>
            <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Video player or progress state */}
          {video.status === 'ready' && video.video_url ? (
            <div className="relative rounded-md overflow-hidden bg-black aspect-[9/16] max-h-[60vh] mx-auto w-fit">
              <video
                src={video.video_url}
                controls
                autoPlay={false}
                className="h-full w-auto mx-auto"
                style={{ maxHeight: '60vh' }}
              />
            </div>
          ) : isGenerating ? (
            <div className="rounded-md bg-muted/50 border border-border p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Generating your video…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{video.generation_stage || 'Processing'}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{video.generation_stage || 'In progress'}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress || 15} className="h-1.5" />
              </div>
              <p className="text-xs text-muted-foreground">This typically takes 5–10 minutes. You can navigate away — we'll notify you when it's ready.</p>
            </div>
          ) : video.status === 'failed' ? (
            <div className="rounded-md bg-destructive/5 border border-destructive/20 p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Generation failed</p>
                {video.error_message && <p className="text-xs text-muted-foreground mt-1">{video.error_message}</p>}
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-muted/50 border border-border p-4 text-center">
              <Film size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Video not yet available</p>
            </div>
          )}

          {/* Script */}
          {video.script && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Script</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-h-28 overflow-y-auto">{video.script}</p>
            </div>
          )}

          {/* Actions */}
          {video.status === 'ready' && video.video_url && (
            <div className="flex gap-2 pt-1">
              <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" size="sm" className="w-full h-9 text-xs gap-1.5">
                  <Play size={12} />Watch in browser
                </Button>
              </a>
              <a href={video.video_url} download className="flex-1">
                <Button size="sm" className="w-full h-9 text-xs gap-1.5">
                  <Download size={12} />Download MP4
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VideoCard({ video, onRetry, onPreview, onDelete }: {
  video: Video;
  onRetry: (id: string) => void;
  onPreview: (v: Video) => void;
  onDelete: (v: Video) => void;
}) {
  const cfg = statusConfig[video.status] || statusConfig.queued;
  const isGenerating = ['generating_script', 'generating_visuals', 'generating_video'].includes(video.status);
  const progress = video.generation_progress ?? 0;

  return (
    <div className="flex items-start gap-3 py-4 border-b border-border last:border-0">
      {/* Thumbnail / preview button */}
      <button
        type="button"
        onClick={() => onPreview(video)}
        className="w-14 h-20 rounded-md bg-muted shrink-0 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity relative group"
      >
        {video.thumbnail_url
          ? <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
          : <Film size={16} className="text-muted-foreground" />}
        {video.status === 'ready' && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
            <Play size={14} className="text-white" />
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-md">
            <Loader2 size={14} className="text-white animate-spin" />
          </div>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onPreview(video)}
          className="text-sm font-medium truncate block text-left hover:text-primary transition-colors w-full"
        >
          {video.title || 'Untitled video'}
        </button>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>

        {/* Live progress bar while generating */}
        {isGenerating && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{video.generation_stage || cfg.label}</span>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress || 12} className="h-1" />
          </div>
        )}

        {video.script && !isGenerating && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{video.script.slice(0, 120)}…</p>
        )}
        {video.error_message && (
          <p className="text-xs text-destructive mt-1">{video.error_message}</p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant={cfg.variant} className="text-[10px] flex items-center gap-1">
            {cfg.icon}{cfg.label}
          </Badge>
          {video.duration_seconds && (
            <span className="text-xs text-muted-foreground">{video.duration_seconds}s</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onPreview(video)}>
          <Play size={11} />{video.status === 'ready' ? 'Preview' : 'Details'}
        </Button>
        {video.status === 'ready' && video.video_url && (
          <a href={video.video_url} download>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 w-full">
              <Download size={11} />MP4
            </Button>
          </a>
        )}
        {video.status === 'failed' && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => onRetry(video.id)}>
            <RefreshCw size={11} />Retry
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(video)}
        >
          <Trash2 size={11} />Delete
        </Button>
      </div>
    </div>
  );
}

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [series, setSeries] = useState<Series | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { startJob, jobs } = useGeneration();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, v] = await Promise.all([seriesApi.get(id), videosApi.listBySeries(id)]);
      setSeries(s);
      setVideos(v);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Refresh video list when a global job for this series completes
  useEffect(() => {
    const doneJobs = jobs.filter(j => j.seriesId === id && j.status === 'done');
    if (doneJobs.length > 0) load();
  }, [jobs, id, load]);

  const toggleAutoPost = async () => {
    if (!series) return;
    const next = !series.auto_posting_enabled;
    await seriesApi.update(series.id, { auto_posting_enabled: next });
    setSeries(prev => prev ? { ...prev, auto_posting_enabled: next } : prev);
    toast.success(`Auto-posting ${next ? 'enabled' : 'disabled'}`);
  };

  const generateNew = async () => {
    if (!series) return;
    setGenerating(true);
    try {
      // 1. Generate script via Edge Function
      const script = await generationApi.generateScript({
        niche: series.niche,
        language: series.language,
        visual_style: series.visual_style,
        skill_id: (series as any).skill_id || undefined,
      });

      // 2. Create video record
      const video = await videosApi.create({ series_id: series.id, title: script.title });
      await videosApi.update(video.id, {
        script: script.script,
        status: 'generating_video',
        generation_stage: 'Submitted',
        generation_progress: 10,
        title: script.title,
      });

      // 3. Submit to Kling
      const submitResult = await generationApi.submitVideo({
        prompt: script.video_prompt,
        aspect_ratio: '9:16',
        duration: '5',
        external_task_id: video.id,
      });

      await videosApi.update(video.id, {
        generation_stage: `Task: ${submitResult.task_id}`,
        generation_progress: 15,
      });

      // 4. Hand off to global background context — user can navigate away freely
      startJob({
        videoId: video.id,
        seriesId: series.id,
        seriesName: series.name,
        taskId: submitResult.task_id,
      });

      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const retryVideo = async (videoId: string) => {
    await videosApi.update(videoId, { status: 'queued', error_message: null });
    toast.success('Video re-queued');
    await load();
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;
    setDeleting(true);
    try {
      await videosApi.delete(videoToDelete.id);
      setVideos(prev => prev.filter(v => v.id !== videoToDelete.id));
      toast.success(`"${videoToDelete.title || 'Video'}" deleted`);
    } catch {
      toast.error('Failed to delete video');
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (!series) return (
    <div className="p-8 text-center text-muted-foreground text-sm">Series not found.</div>
  );

  // Active generation jobs for THIS series
  const activeJobs = jobs.filter(j => j.seriesId === id && (j.status === 'generating' || j.status === 'pending'));

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Preview Modal */}
      <VideoPreviewModal video={previewVideo} open={!!previewVideo} onClose={() => setPreviewVideo(null)} />

      {/* Delete confirm */}
      <AlertDialog open={!!videoToDelete} onOpenChange={open => { if (!open) setVideoToDelete(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{videoToDelete?.title || 'Untitled video'}"</strong> will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 size={13} className="mr-1.5 animate-spin" />Deleting…</> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Back */}
      <Link to="/series" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={13} /> All series
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{series.name}</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{series.niche} · {series.language} · {series.visual_style}</p>
        </div>
        <Button onClick={generateNew} disabled={generating} size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold shrink-0">
          {generating
            ? <><Loader2 size={13} className="mr-1.5 animate-spin" />Generating…</>
            : <><Zap size={13} className="mr-1.5" />Generate video</>}
        </Button>
      </div>

      {/* Live generation progress for active jobs */}
      {activeJobs.length > 0 && (
        <Card className="border border-primary/20 shadow-none" style={{ background: 'var(--gradient-card)' }}>
          <CardContent className="px-5 py-4 space-y-3">
            <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              {activeJobs.length} video{activeJobs.length > 1 ? 's' : ''} generating in background
            </p>
            {activeJobs.map(job => (
              <div key={job.videoId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{job.stage}</span>
                  <span className="text-primary font-semibold shrink-0 ml-2">{job.progress}%</span>
                </div>
                <Progress value={job.progress} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Settings card */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle className="text-sm font-bold">Series settings</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Voice', value: series.voice },
              { label: 'Music', value: series.music_style },
              { label: 'Captions', value: series.caption_style },
              { label: 'Frequency', value: series.posting_frequency === '3x_week' ? '3× per week' : series.posting_frequency === 'daily' ? 'Daily' : 'Pro' },
              { label: 'Post time', value: series.posting_time || '09:00' },
              { label: 'Status', value: series.status },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-muted/70 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-medium capitalize mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label className="text-sm font-medium">Auto-posting</Label>
              <p className="text-xs text-muted-foreground">Automatically post videos to connected accounts</p>
            </div>
            <Switch checked={series.auto_posting_enabled} onCheckedChange={toggleAutoPost} />
          </div>
        </CardContent>
      </Card>

      {/* Videos */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Videos <span className="text-muted-foreground font-normal">({videos.length})</span>
            </CardTitle>
            <Button variant="ghost" size="icon" aria-label="Refresh video list" className="h-7 w-7" onClick={load}>
              <RefreshCw size={13} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {videos.length === 0 ? (
            <div className={cn('flex flex-col items-center justify-center py-10 text-center gap-3')}>
              <Film size={20} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No videos yet.</p>
              <Button size="sm" variant="outline" onClick={generateNew} disabled={generating}>
                <Zap size={13} className="mr-1.5" />Generate first video
              </Button>
            </div>
          ) : (
            <div>
              {videos.map(v => (
                <VideoCard key={v.id} video={v} onRetry={retryVideo} onPreview={setPreviewVideo} onDelete={setVideoToDelete} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
