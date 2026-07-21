import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { seriesApi, videosApi, skillsApi } from '@/services/api';
import { NICHES, LANGUAGES, VISUAL_STYLES, VOICES, MUSIC_STYLES, CAPTION_STYLES } from '@/types/types';
import { CheckCircle2, ChevronRight, ArrowLeft, Zap, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SeriesForm {
  language: string;
  niche: string;
  niche_custom: string;
  visual_style: string;
  voice: string;
  music_style: string;
  caption_style: string;
  name: string;
  posting_frequency: '3x_week' | 'daily' | 'pro';
  posting_time: string;
  posting_days: string[];
  skill_id: string | null;
}

const defaultForm: SeriesForm = {
  language: 'English',
  niche: '',
  niche_custom: '',
  visual_style: 'cinematic',
  voice: 'neutral',
  music_style: 'ambient',
  caption_style: 'bold',
  name: '',
  posting_frequency: 'daily',
  posting_time: '09:00',
  posting_days: ['mon', 'wed', 'fri'],
  skill_id: null,
};

// ── Time presets ─────────────────────────────────────────────────────────────
const TIME_PRESETS = [
  { label: 'Morning', time: '08:00', desc: '8:00 AM — great for commuters' },
  { label: 'Midday', time: '12:00', desc: '12:00 PM — lunch break peak' },
  { label: 'Afternoon', time: '15:00', desc: '3:00 PM — school out / afternoon slump' },
  { label: 'Prime time', time: '19:00', desc: '7:00 PM — highest engagement window' },
  { label: 'Evening', time: '21:00', desc: '9:00 PM — night-time scrolling' },
  { label: 'Late night', time: '23:00', desc: '11:00 PM — niche audience' },
];

const ALL_DAYS = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' }, { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            i < current ? 'gradient-bg text-white' :
            i === current ? 'border-2 border-primary text-primary bg-primary/5' :
            'border border-border text-muted-foreground bg-background'
          )}>
            {i < current ? <CheckCircle2 size={13} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn('w-10 h-px transition-colors', i < current ? 'bg-primary' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  );
}

function OptionCard({ label, description, selected, onClick }: {
  label: string; description?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3.5 rounded-xl border-2 transition-all',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/30 hover:bg-muted/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-sm font-bold', selected ? 'text-primary' : 'text-foreground')}>{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
        </div>
        <div className={cn(
          'w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all',
          selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
        )}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>
    </button>
  );
}

function Step1({ form, setForm }: { form: SeriesForm; setForm: (f: SeriesForm) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Pick your niche</h2>
        <p className="text-sm text-muted-foreground">Choose a content category and language for your series.</p>
      </div>

      {/* Language */}
      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Language</Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              type="button"
              onClick={() => setForm({ ...form, language: lang })}
              className={cn(
                'px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                form.language === lang
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
              )}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Niche */}
      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Niche</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {NICHES.filter(n => n !== 'Custom').map(niche => (
            <button
              key={niche}
              type="button"
              onClick={() => setForm({ ...form, niche })}
              className={cn(
                'px-4 py-3 rounded-xl border-2 text-sm text-left font-semibold transition-all',
                form.niche === niche
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
              )}
            >
              {niche}
            </button>
          ))}
        </div>
      </div>

      {/* Custom niche */}
      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Or enter a custom niche</Label>
        <Input
          placeholder="e.g. Ancient civilizations, Dog training, Crypto beginner tips…"
          value={form.niche_custom}
          onChange={e => setForm({ ...form, niche_custom: e.target.value, niche: e.target.value ? 'Custom' : '' })}
          className="text-sm h-11 px-3"
        />
      </div>
    </div>
  );
}

function Step2({ form, setForm }: { form: SeriesForm; setForm: (f: SeriesForm) => void }) {
  const toggleDay = (day: string) => {
    const days = form.posting_days.includes(day)
      ? form.posting_days.filter(d => d !== day)
      : [...form.posting_days, day];
    setForm({ ...form, posting_days: days });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Make it yours</h2>
        <p className="text-sm text-muted-foreground">Choose your style, voice, and posting schedule.</p>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Visual style</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {VISUAL_STYLES.map(s => (
            <OptionCard key={s.id} label={s.label} description={s.description}
              selected={form.visual_style === s.id} onClick={() => setForm({ ...form, visual_style: s.id })} />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Narrating voice</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {VOICES.map(v => (
            <OptionCard key={v.id} label={v.label} description={v.description}
              selected={form.voice === v.id} onClick={() => setForm({ ...form, voice: v.id })} />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Background music</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {MUSIC_STYLES.map(m => (
            <OptionCard key={m.id} label={m.label} description={m.description}
              selected={form.music_style === m.id} onClick={() => setForm({ ...form, music_style: m.id })} />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Caption style</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CAPTION_STYLES.map(c => (
            <OptionCard key={c.id} label={c.label} description={c.description}
              selected={form.caption_style === c.id} onClick={() => setForm({ ...form, caption_style: c.id })} />
          ))}
        </div>
      </div>

      {/* ── Posting time presets ── */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Posting time</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Pick a preset or enter a custom time for auto-posting.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {TIME_PRESETS.map(p => (
            <button
              key={p.time}
              type="button"
              onClick={() => setForm({ ...form, posting_time: p.time })}
              className={cn(
                'text-left p-3.5 rounded-xl border-2 transition-all',
                form.posting_time === p.time
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30 hover:bg-muted/40'
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Clock size={11} className={form.posting_time === p.time ? 'text-primary' : 'text-muted-foreground'} />
                <span className={cn('text-sm font-bold', form.posting_time === p.time ? 'text-primary' : 'text-foreground')}>{p.label}</span>
                {form.posting_time === p.time && <CheckCircle2 size={11} className="text-primary ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold text-muted-foreground shrink-0">Custom time</Label>
          <Input
            type="time"
            value={form.posting_time}
            onChange={e => setForm({ ...form, posting_time: e.target.value })}
            className="h-9 w-32 text-xs px-2"
          />
          <span className="text-xs text-muted-foreground">(your local timezone)</span>
        </div>
      </div>

      {/* ── Posting days ── */}
      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active posting days</Label>
        <div className="flex gap-2 flex-wrap">
          {ALL_DAYS.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDay(d.id)}
              className={cn(
                'w-11 h-11 rounded-xl text-xs font-bold border-2 transition-all',
                form.posting_days.includes(d.id)
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-medium">
          {form.posting_days.length === 0
            ? 'Select at least one day'
            : `${form.posting_days.length} day${form.posting_days.length > 1 ? 's' : ''} per week selected`}
        </p>
      </div>
    </div>
  );
}

const frequencyOptions = [
  { id: '3x_week', label: '3× per week', desc: 'Beginner — 12 videos/month' },
  { id: 'daily',   label: 'Every day',   desc: 'Daily — 30 videos/month' },
  { id: 'pro',     label: 'Max output',  desc: 'Pro — ~60 videos/month' },
] as const;

function Step3({ form, setForm, activeSkill }: { form: SeriesForm; setForm: (f: SeriesForm) => void; activeSkill?: { name: string; system_prompt: string | null } | null }) {
  const niche = form.niche === 'Custom' ? form.niche_custom : form.niche;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Review & create</h2>
        <p className="text-sm text-muted-foreground">Name your series and confirm your settings.</p>
      </div>

      {/* Settings preview */}
      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {[
          { label: 'Language', value: form.language },
          { label: 'Niche', value: niche || '—' },
          { label: 'Visual style', value: VISUAL_STYLES.find(s => s.id === form.visual_style)?.label || form.visual_style },
          { label: 'Voice', value: VOICES.find(v => v.id === form.voice)?.label || form.voice },
          { label: 'Music', value: MUSIC_STYLES.find(m => m.id === form.music_style)?.label || form.music_style },
          { label: 'Captions', value: CAPTION_STYLES.find(c => c.id === form.caption_style)?.label || form.caption_style },
          { label: 'Post time', value: form.posting_time || '09:00' },
          { label: 'Post days', value: form.posting_days.length > 0 ? form.posting_days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') : 'Not set' },
          ...(activeSkill ? [{ label: 'AI Skill', value: activeSkill.name }] : []),
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground font-medium">{row.label}</span>
            <span className="font-bold">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Series name */}
      <div className="space-y-2">
        <Label htmlFor="series-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Series name</Label>
        <Input
          id="series-name"
          placeholder={`e.g. ${niche ? `My ${niche} Channel` : 'Late Night Stories'}`}
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="text-sm h-11 px-3"
        />
      </div>

      {/* Frequency */}
      <div className="space-y-2.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Posting frequency</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {frequencyOptions.map(opt => (
            <OptionCard key={opt.id} label={opt.label} description={opt.desc}
              selected={form.posting_frequency === opt.id}
              onClick={() => setForm({ ...form, posting_frequency: opt.id })} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CreateSeriesPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SeriesForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [activeSkill, setActiveSkill] = useState<{ name: string; system_prompt: string | null } | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Load skill from URL params
  useEffect(() => {
    const skillId = searchParams.get('skill_id');
    if (skillId) {
      skillsApi.get(skillId).then(skill => {
        if (skill) {
          setActiveSkill({ name: skill.name, system_prompt: skill.system_prompt });
          setForm(f => ({ ...f, skill_id: skillId }));
          // Apply skill content defaults
          if (skill.content?.niche) setForm(f => ({ ...f, niche: String(skill.content.niche), skill_id: skillId }));
          if (skill.content?.language) setForm(f => ({ ...f, language: String(skill.content.language), skill_id: skillId }));
          if (skill.content?.visual_style) setForm(f => ({ ...f, visual_style: String(skill.content.visual_style), skill_id: skillId }));
        }
      }).catch(() => {});
    }
    // Also apply URL params from SkillsPage
    const niche = searchParams.get('niche');
    const language = searchParams.get('language');
    const visualStyle = searchParams.get('visual_style');
    if (niche) setForm(f => ({ ...f, niche }));
    if (language) setForm(f => ({ ...f, language }));
    if (visualStyle) setForm(f => ({ ...f, visual_style: visualStyle }));
  }, [searchParams]);

  const steps = [Step1, Step2, Step3];
  const CurrentStep = steps[step];

  const canAdvance = () => {
    if (step === 0) return !!form.language && (!!form.niche || !!form.niche_custom);
    if (step === 1) return !!form.visual_style && !!form.voice && !!form.music_style && !!form.caption_style;
    if (step === 2) return !!form.name.trim();
    return false;
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const niche = form.niche === 'Custom' ? form.niche_custom : form.niche;
      const series = await seriesApi.create({
        name: form.name.trim(),
        language: form.language,
        niche,
        niche_custom: form.niche === 'Custom' ? form.niche_custom : null,
        visual_style: form.visual_style,
        voice: form.voice,
        music_style: form.music_style,
        caption_style: form.caption_style,
        status: 'active',
        auto_posting_enabled: false,
        instagram_account_id: null,
        youtube_account_id: null,
        skill_id: form.skill_id || null,
        posting_frequency: form.posting_frequency,
        posting_days: form.posting_days,
        posting_time: form.posting_time,
      });
      // Queue first video
      await videosApi.create({ series_id: series.id, title: `${form.name} — Episode 1` });
      toast.success('Series created! Your first video is being queued.');
      navigate(`/series/${series.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create series');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        {step > 0 && (
          <Button variant="ghost" size="icon" onClick={() => setStep(s => s - 1)} className="h-9 w-9 border border-border shrink-0" aria-label="Go back">
            <ArrowLeft size={16} />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Create series</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Step {step + 1} of 3</p>
        </div>
        <StepIndicator current={step} total={3} />
      </div>

      {/* Step content */}
      <div className="mb-10">
        {step === 2
          ? <Step3 form={form} setForm={setForm} activeSkill={activeSkill} />
          : <CurrentStep form={form} setForm={setForm} />
        }
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/series')} className="text-muted-foreground font-semibold">
          Cancel
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold px-6">
            Continue <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={!canAdvance() || creating} size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold px-6">
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating…
              </span>
            ) : (
              <><Zap size={14} className="mr-1.5" />Create series</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
