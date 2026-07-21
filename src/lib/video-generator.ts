/**
 * Client-side video generator — creates videos from images using Canvas + MediaRecorder
 * Falls back to slideshow when Kling API is unavailable
 */

export interface VideoFrame {
  imageUrl: string;
  duration: number; // milliseconds
  transition?: 'fade' | 'slide' | 'zoom';
}

export interface VideoOptions {
  width: number;
  height: number;
  fps: number;
  transitionDuration: number; // ms
}

const DEFAULT_OPTIONS: VideoOptions = {
  width: 576,
  height: 1024,
  fps: 30,
  transitionDuration: 500,
};

/**
 * Generate a video from a series of images
 */
export async function generateVideoFromImages(
  frames: VideoFrame[],
  options: Partial<VideoOptions> = {},
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext('2d')!;

  // Preload all images
  const images = await Promise.all(
    frames.map(async (frame) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load: ${frame.imageUrl}`));
        img.src = frame.imageUrl;
      });
      return img;
    })
  );

  // Setup MediaRecorder with codec fallback
  const stream = canvas.captureStream(opts.fps);
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm',
      videoBitsPerSecond: 5_000_000,
    });
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<Blob>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Recording timed out')), 60_000);
    recorder.onstop = () => {
      clearTimeout(timeout);
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    };
    recorder.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Recording failed'));
    };
  });

  recorder.start();

  // Render each frame with transitions
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const frame = frames[i];
    const frameDuration = frame.duration;
    const transitionFrames = Math.ceil((opts.transitionDuration / 1000) * opts.fps);
    const staticFrames = Math.ceil((frameDuration / 1000) * opts.fps) - transitionFrames;

    // Draw static portion
    for (let f = 0; f < Math.max(0, staticFrames); f++) {
      drawImageFit(ctx, img, opts.width, opts.height);
      await sleep(1000 / opts.fps);
    }

    // Draw transition to next frame
    if (i < images.length - 1 && transitionFrames > 0) {
      const nextImg = images[i + 1];
      for (let f = 0; f < transitionFrames; f++) {
        const progress = f / transitionFrames;
        ctx.globalAlpha = 1 - progress;
        drawImageFit(ctx, img, opts.width, opts.height);
        ctx.globalAlpha = progress;
        drawImageFit(ctx, nextImg, opts.width, opts.height);
        ctx.globalAlpha = 1;
        await sleep(1000 / opts.fps);
      }
    }
  }

  recorder.stop();
  return recordingDone;
}

/**
 * Draw image to fit canvas while maintaining aspect ratio
 */
function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / img.width, height / img.height);
  const x = (width - img.width * scale) / 2;
  const y = (height - img.height * scale) / 2;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate video frames from a script (using Pollinations.ai for images)
 */
export async function generateFramesFromScript(
  script: string,
  numFrames: number = 5,
): Promise<VideoFrame[]> {
  const frames: VideoFrame[] = [];
  const promptLines = script.split('\n').filter((l) => l.trim());

  for (let i = 0; i < Math.min(numFrames, promptLines.length); i++) {
    const prompt = promptLines[i] || `Scene ${i + 1}`;
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=576&height=1024&nologo=true&seed=${i}`;
    frames.push({
      imageUrl: url,
      duration: 3000, // 3 seconds per frame
      transition: 'fade',
    });
  }

  // Ensure minimum frames
  while (frames.length < numFrames) {
    frames.push({
      imageUrl: `https://image.pollinations.ai/prompt/A%20cinematic%20scene%20${frames.length + 1}?width=576&height=1024&nologo=true&seed=${frames.length}`,
      duration: 3000,
      transition: 'fade',
    });
  }

  return frames;
}

/**
 * Download video blob as file
 */
export function downloadVideo(blob: Blob, filename: string = 'video.webm') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
