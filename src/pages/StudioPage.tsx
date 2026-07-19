import { AIStudio } from '@/components/AIStudio';
import { Wand2, Sparkles, Film, ImageIcon } from 'lucide-react';

export default function StudioPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shrink-0">
            <Wand2 size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Studio</h1>
            <p className="text-xs text-muted-foreground">Generate videos and images for your content</p>
          </div>
        </div>
      </div>

      {/* Feature chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: Film, label: 'Faceless video generation' },
          { icon: ImageIcon, label: 'AI image creation' },
          { icon: Sparkles, label: 'Preset prompts included' },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/60 border border-border rounded-full px-3 py-1"
          >
            <Icon size={10} className="text-primary shrink-0" />
            {label}
          </div>
        ))}
      </div>

      {/* AI Studio card */}
      <AIStudio showSubtitle={false} withCard defaultTab="video" />
    </div>
  );
}
