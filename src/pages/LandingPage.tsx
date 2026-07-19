import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Film, CheckCircle, ChevronDown, ChevronUp, ArrowRight, Instagram, Youtube, Zap, BarChart2, Calendar, Sparkles } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Pick your niche',
    description: 'Choose a content category and format. That\'s the only real decision you make.',
    checks: ['Proven niches ready to go', 'Or bring your own idea'],
  },
  {
    number: '02',
    title: 'Make it yours',
    description: 'Pick a voice, a visual style, and your music. We build the rest.',
    checks: ['Realistic, human-sounding voices', 'Ready-made visual styles'],
  },
  {
    number: '03',
    title: 'Watch it build itself',
    description: 'Set your schedule once. We generate your videos automatically and save them in your dashboard.',
    checks: ['Your first video back in minutes', 'Every video saved in your dashboard'],
  },
];

const features = [
  {
    icon: <Film size={20} className="text-primary" />,
    title: 'Fully Faceless',
    desc: 'No camera, no mic. AI narration and generated visuals keep your identity private.',
  },
  {
    icon: <Zap size={20} className="text-primary" />,
    title: 'Auto-Post',
    desc: 'Connect your accounts once. Videos post to Instagram and YouTube Shorts on schedule.',
  },
  {
    icon: <Calendar size={20} className="text-primary" />,
    title: 'Always Consistent',
    desc: 'Never miss an upload again. The system keeps posting even when you\'re busy.',
  },
  {
    icon: <BarChart2 size={20} className="text-primary" />,
    title: 'Growth Tracking',
    desc: 'Watch your followers, views, and monetization progress in one clean dashboard.',
  },
];

const plans = [
  { id: 'beginner', name: 'Beginner', price: 19, freq: '3× per week', videos: '~12 videos/month', highlight: false },
  { id: 'daily',    name: 'Daily',    price: 39, freq: 'Every day',    videos: '~30 videos/month', highlight: true  },
  { id: 'pro',      name: 'Pro',      price: 79, freq: 'Maximum output', videos: '~60 videos/month', highlight: false },
];

const faqs = [
  {
    q: 'Do I have to show my face or use my own voice?',
    a: 'No. Every video is fully faceless, with AI narration and generated visuals. Your face and voice stay private.',
  },
  {
    q: 'Do I need editing or content creation experience?',
    a: 'None at all. You create a series, connect your accounts, and we generate high-quality videos on repeat.',
  },
  {
    q: 'What social media platforms are supported?',
    a: 'You can auto-post to Instagram Reels and YouTube Shorts. Every video can also be downloaded as MP4 and posted anywhere.',
  },
  {
    q: 'Is it safe to connect my accounts?',
    a: 'Yes. We use each platform\'s official API. You sign in on the platform\'s own page — we never see your password and only get permission to publish videos. You can disconnect at any time.',
  },
  {
    q: 'How many videos do I get?',
    a: 'Depends on your plan. Beginner posts 3 videos a week, Daily posts 1 every day, and Pro gives you about 60 videos a month. Run multiple series to multiply that.',
  },
  {
    q: 'Can I cancel? Can I get a refund?',
    a: 'Yes to both. Cancel anytime from your billing settings. Every new subscription comes with a 14-day money-back guarantee — email support within 14 days for a full refund.',
  },
];

const socialProof = [
  { metric: '2.4M+', label: 'Videos generated' },
  { metric: '18K+', label: 'Creators active' },
  { metric: '97%', label: 'Satisfaction rate' },
  { metric: '4.9★', label: 'Average rating' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold">{q}</span>
        {open
          ? <ChevronUp size={16} className="shrink-0 text-muted-foreground" />
          : <ChevronDown size={16} className="shrink-0 text-muted-foreground" />}
      </button>
      {open && <p className="pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-sm">
              <Film size={15} className="text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">AutoReel</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Sign in</Link>
            <Button asChild size="sm" className="btn-glow gradient-bg border-0 text-white font-semibold">
              <Link to="/auth?tab=register">Get started free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-24 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary border border-primary/20 bg-primary/5 rounded-full px-4 py-1.5 mb-8">
            <Sparkles size={12} />
            AI-powered faceless video — now with auto-posting
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-[1.05] mb-6">
            Three steps.<br />
            <span className="gradient-text">Then it runs itself.</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty mb-10 leading-relaxed">
            Pick a niche, customize your style, and set a schedule. AutoReel generates your faceless short-form videos automatically and posts them to Instagram and YouTube Shorts — every single day.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-14">
            <Button asChild size="lg" className="btn-glow gradient-bg border-0 text-white font-semibold h-12 px-8 text-base">
              <Link to="/auth?tab=register">Start for free <ArrowRight size={16} className="ml-1.5" /></Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 px-8 text-base font-semibold border border-border hover:border-primary/30">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>

          {/* Social proof strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {socialProof.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold gradient-text">{s.metric}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Platform badges */}
          <div className="flex items-center justify-center gap-6 mt-10 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Instagram size={13} className="text-pink-500" />Instagram Reels</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-1.5"><Youtube size={13} className="text-red-500" />YouTube Shorts</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>14-day money-back guarantee</span>
          </div>
        </div>
      </section>

      {/* ── 3 Steps ── */}
      <section id="how" className="border-y border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">Simple enough to start today</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {steps.map((step, i) => (
              <div key={step.number} className="relative space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-sm shrink-0">
                    <span className="text-white font-bold text-sm">{i + 1}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute left-14 top-5 w-full h-px border-t border-dashed border-primary/30" />
                  )}
                </div>
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                <ul className="space-y-2">
                  {step.checks.map(c => (
                    <li key={c} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle size={14} className="text-primary shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ background: 'var(--gradient-hero)' }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">Everything to stay consistent</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="bg-background rounded-xl border border-border p-6 card-hover space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Simple, transparent pricing</h2>
            <p className="text-sm text-muted-foreground">14-day money-back guarantee on all plans. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map(plan => (
              <div
                key={plan.id}
                className={`rounded-xl border p-7 space-y-6 transition-all ${
                  plan.highlight
                    ? 'border-primary bg-primary/4 shadow-lg shadow-primary/10 scale-[1.02]'
                    : 'border-border hover:border-primary/30 card-hover'
                }`}
              >
                {plan.highlight && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white gradient-bg rounded-full px-3 py-1">
                    <Sparkles size={9} />Most popular
                  </span>
                )}
                <div>
                  <h3 className="font-bold text-base mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold tracking-tight">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 text-sm">
                  {[plan.freq, plan.videos, 'Instagram + YouTube Shorts', 'MP4 download'].map(item => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircle size={14} className="text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full h-10 font-semibold ${plan.highlight ? 'gradient-bg border-0 text-white btn-glow' : ''}`}
                  variant={plan.highlight ? 'default' : 'outline'}
                >
                  <Link to="/auth?tab=register">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-border" style={{ background: 'var(--gradient-hero)' }}>
        <div className="max-w-3xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">Frequently asked questions</h2>
          </div>
          <div className="bg-background rounded-xl border border-border px-6">
            {faqs.map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
            <Film size={24} className="text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Ready to automate your channel?</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">No editing. No scheduling. No burnout. Just consistent content, every day.</p>
          <Button asChild size="lg" className="btn-glow gradient-bg border-0 text-white font-semibold h-12 px-8 text-base">
            <Link to="/auth?tab=register">Start for free <ArrowRight size={16} className="ml-1.5" /></Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-4">No credit card required · 14-day money-back guarantee</p>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md gradient-bg flex items-center justify-center">
              <Film size={10} className="text-white" />
            </div>
            AutoReel
          </span>
          <span>© {new Date().getFullYear()} AutoReel. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
