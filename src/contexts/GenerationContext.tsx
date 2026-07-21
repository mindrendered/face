import {
  createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode
} from 'react';
import { toast } from 'sonner';
import { videosApi } from '@/services/api';
import { generationApi } from '@/services/generation';
import { trackVideoGenerated } from '@/lib/analytics';
import type { Video } from '@/types/types';

interface GenerationJob {
  videoId: string;
  seriesId: string;
  seriesName: string;
  taskId: string | null;
  status: 'pending' | 'generating' | 'done' | 'failed';
  progress: number;
  stage: string;
  startedAt: number;
}

interface GenerationContextType {
  jobs: GenerationJob[];
  activeCount: number;
  startJob: (params: {
    videoId: string;
    seriesId: string;
    seriesName: string;
    taskId: string;
  }) => void;
  clearDone: () => void;
}

const GenerationContext = createContext<GenerationContextType>({
  jobs: [],
  activeCount: 0,
  startJob: () => {},
  clearDone: () => {},
});

const POLL_INTERVAL = 12000; // 12 s — keeps well under 150s idle timeout
const STAGE_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  processing: 'Generating video',
  succeed: 'Complete',
  failed: 'Failed',
};

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateJob = useCallback((videoId: string, patch: Partial<GenerationJob>) => {
    setJobs(prev => prev.map(j => j.videoId === videoId ? { ...j, ...patch } : j));
  }, []);

  const pollJobs = useCallback(async (activeJobs: GenerationJob[]) => {
    for (const job of activeJobs) {
      if (!job.taskId) continue;
      try {
        const result = await generationApi.queryVideo(job.taskId);
        const taskStatus = result.task_status;
        const stage = STAGE_LABELS[taskStatus] || taskStatus;

        if (taskStatus === 'succeed') {
          const videos = result.task_result?.videos;
          const videoUrl = videos?.[0]?.url ?? null;
          const duration = videos?.[0]?.duration ? parseInt(videos[0].duration) : null;
          await videosApi.update(job.videoId, {
            status: 'ready',
            video_url: videoUrl,
            duration_seconds: duration,
            generation_progress: 100,
            generation_stage: 'Complete',
          });
          updateJob(job.videoId, { status: 'done', progress: 100, stage: 'Complete' });
          trackVideoGenerated(job.seriesId, 'kling');
          toast.success(`✅ Video ready: ${job.seriesName}`, {
            description: 'Your video has been generated. Go to My Series to view it.',
            duration: 8000,
          });
        } else if (taskStatus === 'failed') {
          const errMsg = result.task_status_msg || 'Generation failed';
          const retries = (await videosApi.listBySeries(job.seriesId))
            .find((v: Video) => v.id === job.videoId)?.retry_count ?? 0;
          await videosApi.update(job.videoId, {
            status: 'failed',
            error_message: errMsg,
            generation_progress: 0,
          });
          updateJob(job.videoId, { status: 'failed', stage: 'Failed' });
          if (retries < 3) {
            // auto-retry
            await videosApi.update(job.videoId, { status: 'queued', retry_count: retries + 1, error_message: null });
            toast.warning(`⚠️ Retrying video (${retries + 1}/3): ${job.seriesName}`);
          } else {
            toast.error(`❌ Video generation failed: ${job.seriesName}`, { duration: 10000 });
          }
        } else {
          // Still in progress — increment progress estimate
          const elapsed = (Date.now() - job.startedAt) / 1000;
          const progress = Math.min(90, Math.round((elapsed / 420) * 90)); // estimate over 7 min
          await videosApi.update(job.videoId, {
            generation_progress: progress,
            generation_stage: stage,
          });
          updateJob(job.videoId, { progress, stage });
        }
      } catch (err) {
        // Network error during poll — skip this cycle, retry next tick
        console.error('Poll error for job', job.videoId, err);
      }
    }
  }, [updateJob]);

  // Global polling loop — runs as long as there are active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(j => j.status === 'generating' || j.status === 'pending');
    if (activeJobs.length === 0) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setJobs(current => {
          const active = current.filter(j => j.status === 'generating' || j.status === 'pending');
          if (active.length > 0) pollJobs(active);
          return current;
        });
      }, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [jobs, pollJobs]);

  // Cleanup on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const startJob = useCallback(({ videoId, seriesId, seriesName, taskId }: {
    videoId: string; seriesId: string; seriesName: string; taskId: string;
  }) => {
    setJobs(prev => {
      if (prev.find(j => j.videoId === videoId)) return prev;
      return [...prev, {
        videoId, seriesId, seriesName, taskId,
        status: 'generating', progress: 10, stage: 'Submitted',
        startedAt: Date.now(),
      }];
    });
    toast.info(`🎬 Generating video for "${seriesName}"`, {
      description: 'You can browse other pages — we\'ll notify you when it\'s ready.',
      duration: 6000,
    });
  }, []);

  const clearDone = useCallback(() => {
    setJobs(prev => prev.filter(j => j.status === 'generating' || j.status === 'pending'));
  }, []);

  return (
    <GenerationContext.Provider value={{ jobs, activeCount: jobs.filter(j => j.status === 'generating').length, startJob, clearDone }}>
      {children}
    </GenerationContext.Provider>
  );
}

export const useGeneration = () => useContext(GenerationContext);
