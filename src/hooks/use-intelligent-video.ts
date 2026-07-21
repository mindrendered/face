import { useEffect, useRef, useState, useCallback } from 'react';
import { generationApi } from '@/services/generation';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { generateVideoFromImages, generateFramesFromScript, downloadVideo, type VideoFrame } from '@/lib/video-generator';

export type VideoStatus = 'idle' | 'submitting' | 'generating_images' | 'creating_video' | 'polling' | 'done' | 'failed';

export interface UseIntelligentVideoOptions {
  onSave?: (url: string, type: 'video') => void;
}

/**
 * Intelligent video generation — tries Kling first, falls back to client-side
 */
export function useIntelligentVideo({ onSave }: UseIntelligentVideoOptions = {}) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [duration, setDuration] = useState<'5' | '10'>('5');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [method, setMethod] = useState<'kling' | 'client' | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const submit = async () => {
    if (!prompt.trim()) return;
    setStatus('submitting');
    setProgress(5);
    setStage('Trying Kling API...');
    setUrl(null);
    setMethod(null);

    try {
      // Step 1: Try Kling API first
      const { task_id: newTaskId } = await generationApi.submitVideo({
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        duration,
      });

      // Kling succeeded — poll for result
      setTaskId(newTaskId);
      setStatus('polling');
      setStage('Generating video with Kling...');
      setProgress(10);
      setMethod('kling');
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
            if (resultUrl) onSave?.(resultUrl, 'video');
            else toast.success('Video generated successfully!');
          } else if (s === 'failed') {
            clearInterval(pollRef.current!);
            // Kling failed — try client-side fallback
            await tryClientSideGeneration();
          } else {
            setProgress(est);
            setStage(s === 'processing' ? 'Rendering frames…' : 'Queued…');
          }
        } catch { /* skip cycle */ }
      }, 10000);
    } catch (klingError) {
      // Kling failed (quota, network, etc.) — fall back to client-side
      console.log('Kling failed, trying client-side:', klingError);
      await tryClientSideGeneration();
    }
  };

  const tryClientSideGeneration = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus('generating_images');
    setProgress(20);
    setStage('Generating images with AI...');
    setMethod('client');

    try {
      // Step 2: Generate images via Pollinations.ai
      const numFrames = duration === '10' ? 8 : 5;
      const scriptLines = prompt.split(/[.\n!]+/).filter(l => l.trim()).slice(0, numFrames);
      while (scriptLines.length < numFrames) {
        scriptLines.push(`Scene ${scriptLines.length + 1}: ${prompt}`);
      }

      const frames: VideoFrame[] = scriptLines.map((line, i) => ({
        imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(line.trim())}?width=${aspectRatio === '16:9' ? 1024 : 576}&height=${aspectRatio === '16:9' ? 576 : 1024}&nologo=true&seed=${i}`,
        duration: (duration === '10' ? 10000 : 5000) / numFrames,
        transition: 'fade',
      }));

      setProgress(40);
      setStage('Loading AI images...');

      // Preload images
      await Promise.all(frames.map(async (frame) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // continue even if some fail
          img.src = frame.imageUrl;
        });
      }));

      setProgress(70);
      setStage('Creating video...');

      // Step 3: Create video from images
      const videoBlob = await generateVideoFromImages(frames, {
        width: aspectRatio === '16:9' ? 1024 : 576,
        height: aspectRatio === '16:9' ? 576 : 1024,
        fps: 30,
      });

      // Create downloadable URL
      const videoUrl = URL.createObjectURL(videoBlob);
      setUrl(videoUrl);
      setStatus('done');
      setProgress(100);
      setStage('Video created!');

      toast.success('Video created from AI images!', {
        description: 'Click download to save your video.',
      });

      onSave?.(videoUrl, 'video');
    } catch (clientError) {
      setStatus('failed');
      setStage('Generation failed');
      toast.error('Video generation failed. Please try again.');
      console.error('Client-side video generation failed:', clientError);
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
    setMethod(null);
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
    method,
    submit,
    reset,
    download: () => {
      if (url) downloadVideo(url, `video-${Date.now()}.webm`);
    },
  };
}
