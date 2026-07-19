import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { seriesApi } from '@/services/api';
import type { Series } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wand2, Film, ImageIcon, Download, X, Sparkles, Loader2,
  Clock, CheckCircle2, AlertCircle, Info, FolderOpen, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useVideoGeneration } from '@/hooks/use-video-generation';
import { useImageGeneration } from '@/hooks/use-image-generation';

// ── Prompt presets — cinematic, trendy, Shorts-optimised ─────────────────────
export const VIDEO_PRESETS = [
  {
    label: 'Viral Hook Reel',
    prompt: 'Cinematic vertical 9:16 Reels/Shorts video. Opens with a fast-paced hook montage in the first 2 seconds — bold animated text overlay on a moody dark background. Smooth dolly-zoom transitions between shots. Aesthetic B-roll of glowing city lights at golden hour. Satisfying cut-to-beat rhythm. Professional colour grade: deep shadows, vivid highlights. Seamless looping end card. No faces, voiceover-ready, text-safe centre framing.',
  },
  {
    label: 'Faceless Tutorial',
    prompt: 'Ultra-clean faceless tutorial Reel, 9:16 vertical. Screen-recording style B-roll with smooth animated pointer cues and glowing step-by-step callouts. Minimal white background with soft drop shadows on UI elements. Each step transitions with a crisp slide-wipe. Informative lower-third text bars. Professional instructional tone, calm pacing, 30 fps motion-blur consistency throughout.',
  },
  {
    label: 'Golden-Hour Lifestyle',
    prompt: 'Cinematic golden-hour lifestyle montage, 9:16 vertical. Slow-motion B-roll: sunlight filtering through leaves, coffee steam rising, journal writing close-up. Warm film emulation — rich oranges, soft magentas. Smooth handheld-stabilised camera motion. Subtle Ken-Burns on stills. Title card in elegant thin serif font fades in at 1 second. Seamless crossfade transitions, no jump cuts.',
  },
  {
    label: 'Finance/Wealth Tips',
    prompt: 'High-energy finance tips video, 9:16 Shorts format. Opens with shocking stat in bold kinetic typography on a dark gradient background. B-roll: stock charts animating upward, crisp dollar coins stacking, luxury skyline timelapse. Colour palette: emerald green and charcoal. Fast-cut rhythm synced to a punchy beat. Each tip appears as animated card slide-in. Professional, credible, aspirational tone.',
  },
  {
    label: 'Trending Tech Explainer',
    prompt: 'Sleek tech explainer reel, 9:16 vertical. Futuristic HUD-style animated overlays on dark background. Smooth 3D icon transitions between talking points. Electric blue and violet accent colours. Informative lower-third labels. Subtle particle background. Each concept revealed with a crisp reveal animation. Data-visualisation charts animate in smoothly. No face, no hands — full abstract visual storytelling.',
  },
  {
    label: 'Motivation / Mindset',
    prompt: 'Powerful motivational video, 9:16 Shorts. Dramatic cinematic B-roll: storm clouds breaking into sunrise, lone mountain climber silhouette, ocean waves. Overlaid bold all-caps quote in high-contrast white on dark. Emotional pacing — slow build to fast-cut climax at 15 seconds. Colour grade: desaturated with punchy contrast. Epic orchestral music vibe. Seamless fade-to-black outro with CTA text.',
  },
];

export const IMAGE_PRESETS = [
  {
    label: 'Viral Thumbnail',
    prompt: 'Ultra-high-impact YouTube Shorts thumbnail, 9:16 vertical. Bold 3D bevelled headline text in white with neon-orange outline, occupying top third. Dramatic gradient background transitioning from deep navy to vibrant coral. Central focal zone left clear for subject. Bright directional lighting from upper-left. High contrast, 4K crispness. Professional graphic-design finish. Platform-safe safe zones observed.',
  },
  {
    label: 'Aesthetic Cover',
    prompt: 'Minimalist Instagram Reels cover, 1:1 square. Soft sage-green gradient background, single elegant botanical illustration centred. Series title in refined thin sans-serif at bottom, generous white space. Muted pastel colour palette — ivory, dusty rose, eucalyptus. Fine-grain film texture overlay. Luxury editorial aesthetic. Clean, scroll-stopping visual hierarchy.',
  },
  {
    label: 'Dark Series Banner',
    prompt: 'Premium content series banner, 16:9 wide. Deep charcoal background with subtle topographic line texture. Series logo placeholder centred with glowing indigo halo. Thin horizontal rule in violet beneath title. Episode/series name in crisp modern sans-serif, letter-spaced. Subtle lens-flare accent top-right. Cinematic widescreen letterbox bars. Professional streaming-platform aesthetic.',
  },
  {
    label: 'Niche Background',
    prompt: 'Versatile faceless-content background image, 9:16 vertical. Abstract flowing gradient in soft teal and warm amber. Micro-texture overlay for depth. Generous centred safe-zone for text overlay. No distracting elements in the middle third. Smooth gaussian-blur vignette on edges. Mood: calm, professional, modern. Suitable for finance, wellness, productivity, tech niches.',
  },
  {
    label: 'Intro Branding Card',
    prompt: 'Polished video intro card / end-card graphic, 9:16 vertical. Bold geometric shape framing a clean brand-name placeholder. Gradient background: deep violet to electric blue. Glowing accent lines radiating from centre. Social media handle zone at bottom in high-legibility font. Subtle animated-look layering effect. Premium, trustworthy, creator-brand aesthetic.',
  },
  {
    label: 'Informative Carousel',
    prompt: 'Eye-catching first slide for an Instagram carousel post, 1:1 square. Bold headline stat in oversized numerals on a cream background — "5 FACTS THAT CHANGED MY LIFE". Thin accent border in deep teal. Source citation in small monospace font at bottom. Clean editorial layout, generous padding. Highly readable on mobile. Swipe-worthy information design.',
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function PresetChips({ presets, onSelect, disabled }: {
  presets: { label: string; prompt: string }[];
  onSelect: (p: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map(p => (
        <button
          key={p.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(p.prompt)}
          className="text-[11px] px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles size={9} className="inline mr-1 text-primary" />
          {p.label}
        </button>
      ))}
    </div>
  );
}

function ProgressCard({ stage, progress, taskId, status }: {
  stage: string;
  progress: number;
  taskId: string | null;
  status: 'submitting' | 'polling' | 'done' | 'failed';
}) {
  const icon = status === 'done'
    ? <CheckCircle2 size={13} className="text-green-600 shrink-0" />
    : status === 'failed'
    ? <AlertCircle size={13} className="text-destructive shrink-0" />
    : <Loader2 size={13} className="animate-spin text-primary shrink-0" />;

  return (
    <div className="space-y-2.5 p-4 rounded-xl bg-primary/5 border border-primary/15">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-primary flex-1 min-w-0 truncate">{stage}</span>
        <span className="text-xs font-bold text-primary shrink-0">{progress}%</span>
      </div>
      <Progress value={progress} className="h-1.5" />
      {taskId && (
        <p className="text-[10px] text-muted-foreground font-mono truncate">ID: {taskId}</p>
      )}
    </div>
  );
}

function ResultActions({ url, type, onClear }: {
  url: string;
  type: 'video' | 'image';
  onClear: () => void;
}) {
  return (
    <div className="flex gap-2">
      <a href={url} download className="flex-1">
        <Button variant="outline" size="sm" className="w-full h-9 text-xs gap-1.5 font-medium">
          <Download size={12} />
          {type === 'video' ? 'Download MP4' : 'Download image'}
        </Button>
      </a>
      <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5 font-medium" onClick={onClear}>
        <X size={12} />New
      </Button>
    </div>
  );
}

// ── Main AIStudio component ───────────────────────────────────────────────────
export interface AIStudioProps {
  /** Show descriptive subtitle below the heading */
  showSubtitle?: boolean;
  /** If false, renders bare content without Card wrapper */
  withCard?: boolean;
  /** Default active tab */
  defaultTab?: 'video' | 'image';
}

export function AIStudio({ showSubtitle = true, withCard = true, defaultTab = 'video' }: AIStudioProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'video' | 'image'>(defaultTab);

  // ── Series selector state ─────────────────────────────────────────────
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('none');

  useEffect(() => {
    seriesApi.list().then(setSeries).catch(() => {/* silent */});
  }, []);

  // Helper: save generated media to the selected series
  const saveToSeries = async (url: string, type: 'video' | 'image', title: string) => {
    if (selectedSeriesId === 'none') return;
    try {
      const { error } = await supabase.from('videos').insert({
        series_id: selectedSeriesId,
        title,
        [type === 'video' ? 'video_url' : 'thumbnail_url']: url,
        status: 'ready',
        generation_progress: 100,
      });
      if (error) throw error;
      const seriesName = series.find(s => s.id === selectedSeriesId)?.name ?? 'series';
      toast.success(
        `Saved to "${seriesName}"`,
        {
          description: 'Your generated media has been added to the series.',
          action: {
            label: 'View series',
            onClick: () => navigate(`/series/${selectedSeriesId}`),
          },
          duration: 8000,
        }
      );
    } catch {
      toast.warning('Media generated — but could not link to series. Saved as standalone.');
    }
  };

  // ── Generation hooks ──────────────────────────────────────────────────────
  const video = useVideoGeneration({
    onSave: (url) => saveToSeries(url, 'video', `AI Video — ${new Date().toLocaleDateString()}`),
  });
  const image = useImageGeneration({
    onSave: (url) => saveToSeries(url, 'image', `AI Image — ${new Date().toLocaleDateString()}`),
  });

  const videoActive = video.status === 'submitting' || video.status === 'polling';
  const imageActive = image.status === 'submitting' || image.status === 'polling';

  const content = (
    <div className="space-y-4">
      {/* ── Series selector ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FolderOpen size={11} />Add to series
        </Label>
        <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Select a series (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No series — save as standalone</SelectItem>
            {series.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                <span className="ml-1.5 text-muted-foreground text-[10px]">· {s.niche}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSeriesId !== 'none' && (
          <button
            type="button"
            onClick={() => navigate(`/series/${selectedSeriesId}`)}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
          >
            <ExternalLink size={10} />View series
          </button>
        )}
      </div>

    <Tabs value={tab} onValueChange={v => setTab(v as 'video' | 'image')}>
      <TabsList className="h-9 text-xs mb-5 p-1">
        <TabsTrigger value="video" className="text-xs gap-1.5 font-semibold">
          <Film size={12} />Video
        </TabsTrigger>
        <TabsTrigger value="image" className="text-xs gap-1.5 font-semibold">
          <ImageIcon size={12} />Image
        </TabsTrigger>
      </TabsList>

      {/* ── VIDEO TAB ── */}
      <TabsContent value="video" className="space-y-4 mt-0">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick prompts</Label>
          <PresetChips presets={VIDEO_PRESETS} onSelect={video.setPrompt} disabled={videoActive} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompt</Label>
          <Textarea
            placeholder="Describe the video you want to generate…"
            value={video.prompt}
            onChange={e => video.setPrompt(e.target.value)}
            className="text-sm min-h-[96px] px-3 resize-none"
            disabled={videoActive}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Aspect ratio</Label>
            <Select value={video.aspectRatio} onValueChange={v => video.setAspectRatio(v as typeof video.aspectRatio)} disabled={videoActive}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 — Reels / Shorts</SelectItem>
                <SelectItem value="16:9">16:9 — Landscape</SelectItem>
                <SelectItem value="1:1">1:1 — Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Duration</Label>
            <Select value={video.duration} onValueChange={v => video.setDuration(v as typeof video.duration)} disabled={videoActive}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 seconds</SelectItem>
                <SelectItem value="10">10 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Time estimate notice */}
        {video.status === 'idle' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Clock size={12} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Video generation typically takes <strong>5–10 minutes</strong>. You can navigate away — generation continues in the background and you'll be notified when done.
            </p>
          </div>
        )}

        {/* Progress */}
        {(videoActive || video.status === 'done' || video.status === 'failed') && (
          <ProgressCard
            stage={video.stage}
            progress={video.progress}
            taskId={video.taskId}
            status={video.status as 'submitting' | 'polling' | 'done' | 'failed'}
          />
        )}

        {/* Video result */}
        {video.status === 'done' && video.url && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-black aspect-video border border-border">
              <video src={video.url} controls className="w-full h-full" />
            </div>
            <ResultActions url={video.url} type="video" onClear={video.reset} />
          </div>
        )}

        {video.status === 'failed' && (
          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5 w-full font-medium" onClick={video.reset}>
            <X size={12} />Clear &amp; try again
          </Button>
        )}

        {/* Generate / loading button */}
        {!videoActive && video.status !== 'done' && (
          <Button
            onClick={video.submit}
            disabled={!video.prompt.trim()}
            size="sm"
            className="w-full h-10 text-xs gap-1.5 gradient-bg border-0 text-white font-semibold"
          >
            <Film size={13} />Generate video
          </Button>
        )}
        {videoActive && (
          <div className="w-full h-10 text-xs inline-flex items-center justify-center rounded-md bg-primary/10 text-primary cursor-not-allowed select-none px-3 gap-2 font-medium border border-primary/20">
            <Loader2 size={13} className="animate-spin" />Generating… (~5–10 min)
          </div>
        )}
      </TabsContent>

      {/* ── IMAGE TAB ── */}
      <TabsContent value="image" className="space-y-4 mt-0">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick prompts</Label>
          <PresetChips presets={IMAGE_PRESETS} onSelect={image.setPrompt} disabled={imageActive} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompt</Label>
          <Textarea
            placeholder="Describe the image you want to generate…"
            value={image.prompt}
            onChange={e => image.setPrompt(e.target.value)}
            className="text-sm min-h-[96px] px-3 resize-none"
            disabled={imageActive}
          />
        </div>

        {/* Time estimate notice */}
        {image.status === 'idle' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info size={12} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Image generation typically takes <strong>1–2 minutes</strong>. The result will be saved to your media library automatically.
            </p>
          </div>
        )}

        {/* Progress */}
        {(imageActive || image.status === 'done' || image.status === 'failed') && (
          <ProgressCard
            stage={image.status === 'done' ? 'Complete' : image.status === 'failed' ? 'Generation failed' : 'Generating image…'}
            progress={image.progress}
            taskId={image.taskId}
            status={image.status as 'submitting' | 'polling' | 'done' | 'failed'}
          />
        )}

        {/* Image result */}
        {image.status === 'done' && image.url && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
              <img src={image.url} alt="Generated" className="w-full h-auto object-contain max-h-72" />
            </div>
            <ResultActions url={image.url} type="image" onClear={image.reset} />
          </div>
        )}

        {image.status === 'failed' && (
          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5 w-full font-medium" onClick={image.reset}>
            <X size={12} />Clear &amp; try again
          </Button>
        )}

        {!imageActive && image.status !== 'done' && (
          <Button
            onClick={image.submit}
            disabled={!image.prompt.trim()}
            size="sm"
            className="w-full h-10 text-xs gap-1.5 gradient-bg border-0 text-white font-semibold"
          >
            <ImageIcon size={13} />Generate image
          </Button>
        )}
        {imageActive && (
          <div className="w-full h-10 text-xs inline-flex items-center justify-center rounded-md bg-primary/10 text-primary cursor-not-allowed select-none px-3 gap-2 font-medium border border-primary/20">
            <Loader2 size={13} className="animate-spin" />Generating… (~1–2 min)
          </div>
        )}
      </TabsContent>
    </Tabs>
    </div>
  );

  if (!withCard) return content;

  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shrink-0">
            <Wand2 size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-bold">AI Generation Studio</CardTitle>
            {showSubtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate videos &amp; images for your content series using AI.
              </p>
            )}
          </div>
          <Badge className="gradient-bg border-0 text-white text-[10px] font-bold shrink-0">AI</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {content}
      </CardContent>
    </Card>
  );
}
