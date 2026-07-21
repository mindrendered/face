import { useEffect, useRef, useState } from 'react';
import { generationApi } from '@/services/generation';
import { toast } from 'sonner';

export type VideoStatus = 'idle' | 'submitting' | 'polling' | 'done' | 'failed';

export interface UseVideoGenerationOptions {
  onSave?: (url: string, type: 'video') => void;
}

export function useVideoGeneration({ onSave }: UseVideoGenerationOptions = {}) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [duration, setDuration] = useState<'5' | '10'>('5');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const submit = async () => {
    if (!prompt.trim()) return;
    setStatus('submitting');
    setProgress(5);
    setStage('Submitting task…');
    setUrl(null);
    try {
      const { task_id: newTaskId } = await generationApi.submitVideo({ prompt: prompt.trim(), aspect_ratio: aspectRatio, duration });
      setTaskId(newTaskId);
      setStatus('polling');
      setStage('Generating video…');
      setProgress(10);
      startRef.current = Date.now();

      pollRef.current = setInterval(async () => {
        try {
          const qd = await generationApi.queryVideo(newTaskId);

          const s: string = qd.task_status;
          const elapsed = (Date.now() - startRef.current) / 1000;
          const est = Math.min(88, Math.round((elapsed / 420) * 88));

          if (s === 'succeed') {
            clearInterval(pollRef.current!);
            const resultUrl: string | null = qd.task_result?.videos?.[0]?.url ?? null;
            setUrl(resultUrl);
            setStatus('done');
            setProgress(100);
            setStage('Complete');
            if (resultUrl) {
              onSave?.(resultUrl, 'video');
            } else {
              toast.success('Video generated successfully!');
            }
          } else if (s === 'failed') {
            clearInterval(pollRef.current!);
            setStatus('failed');
            setStage('Generation failed');
            toast.error('Video generation failed');
          } else {
            setProgress(est);
            setStage(s === 'processing' ? 'Rendering frames…' : 'Queued…');
          }
        } catch { /* skip cycle on transient network error */ }
      }, 10000);
    } catch (e: unknown) {
      setStatus('failed');
      setStage('Submission error');
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (url) URL.revokeObjectURL(url);
    setStatus('idle');
    setProgress(0);
    setStage('');
    setTaskId(null);
    setUrl(null);
    setPrompt('');
  };

  return {
    prompt, setPrompt,
    aspectRatio, setAspectRatio,
    duration, setDuration,
    taskId,
    status,
    progress,
    stage,
    url,
    submit,
    reset,
  };
}
