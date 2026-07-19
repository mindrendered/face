import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';

export type ImageStatus = 'idle' | 'submitting' | 'polling' | 'done' | 'failed';

export interface UseImageGenerationOptions {
  onSave?: (url: string, type: 'image') => void;
}

export function useImageGeneration({ onSave }: UseImageGenerationOptions = {}) {
  const [prompt, setPrompt] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<ImageStatus>('idle');
  const [progress, setProgress] = useState(0);
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
    setUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke('image-generation-submit', {
        body: { contents: [{ parts: [{ text: prompt.trim() }] }] },
      });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data?.error || 'Submit failed');
      if (data?.status !== 0) throw new Error(`API error: ${data?.message}`);

      const newTaskId: string = data.data.taskId;
      setTaskId(newTaskId);
      setStatus('polling');
      setProgress(15);
      startRef.current = Date.now();

      pollRef.current = setInterval(async () => {
        try {
          const { data: qd, error: qe } = await supabase.functions.invoke('image-generation-query', {
            body: { taskId: newTaskId },
          });
          if (qe) return;
          if (qd?.success === false) return;

          const s: string = qd?.data?.status;
          const elapsed = (Date.now() - startRef.current) / 1000;
          const est = Math.min(88, Math.round((elapsed / 120) * 88));

          if (s === 'SUCCESS') {
            clearInterval(pollRef.current!);
            const resultUrl: string | null = qd.data.imageUrl ?? null;
            setUrl(resultUrl);
            setStatus('done');
            setProgress(100);
            if (resultUrl) {
              onSave?.(resultUrl, 'image');
            } else {
              toast.success('Image generated successfully!');
            }
          } else if (s === 'FAILED' || s === 'TIMEOUT') {
            clearInterval(pollRef.current!);
            setStatus('failed');
            toast.error(`Image generation ${s === 'TIMEOUT' ? 'timed out' : 'failed'}`);
          } else {
            setProgress(est);
          }
        } catch { /* skip */ }
      }, 7000);
    } catch (e: unknown) {
      setStatus('failed');
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus('idle');
    setProgress(0);
    setTaskId(null);
    setUrl(null);
    setPrompt('');
  };

  return {
    prompt, setPrompt,
    taskId,
    status,
    progress,
    url,
    submit,
    reset,
  };
}
