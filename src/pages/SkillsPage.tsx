import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { skillsApi, aiProvidersApi, type Skill, type AiProvider } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Plus, Download, Upload, Trash2, Globe, Lock,
  Package, Sparkles, Palette, Tag, FileJson, Bot, Mic, Shirt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Package; color: string }> = {
  template: { label: 'Template', icon: Package, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  prompt_pack: { label: 'Prompt Pack', icon: Sparkles, color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
  style: { label: 'Style', icon: Palette, color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  niche: { label: 'Niche', icon: Tag, color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
  ai_prompt: { label: 'AI Prompt', icon: Bot, color: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400' },
  voice_style: { label: 'Voice Style', icon: Mic, color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400' },
  brand_kit: { label: 'Brand Kit', icon: Shirt, color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' },
};

const FILTER_OPTIONS = ['all', 'template', 'prompt_pack', 'style', 'niche', 'ai_prompt', 'voice_style', 'brand_kit'];

export default function SkillsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [creating, setCreating] = useState(false);
  const [newSkill, setNewSkill] = useState({
    name: '',
    description: '',
    type: 'template' as Skill['type'],
    content: '{\n  \n}',
    system_prompt: '',
    model_override: '',
    temperature: 0.7,
    max_tokens: 1024,
    ai_provider_id: '',
  });

  const loadSkills = useCallback(async () => {
    try {
      const data = await skillsApi.list(filter === 'all' ? undefined : filter);
      setSkills(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadProviders = useCallback(async () => {
    try {
      const data = await aiProvidersApi.list();
      setProviders(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSkills(); loadProviders(); }, [loadSkills, loadProviders]);

  const handleCreate = async () => {
    if (!newSkill.name.trim()) return;
    setCreating(true);
    try {
      let content: Record<string, unknown>;
      try { content = JSON.parse(newSkill.content); } catch { throw new Error('Invalid JSON content'); }
      const payload = {
        name: newSkill.name,
        description: newSkill.description || null,
        type: newSkill.type,
        content,
        is_public: false,
        system_prompt: newSkill.system_prompt || null,
        model_override: newSkill.model_override || null,
        temperature: newSkill.temperature,
        max_tokens: newSkill.max_tokens,
        ai_provider_id: newSkill.ai_provider_id || null,
      };
      const skill = await skillsApi.create(payload as any);
      setSkills(prev => [skill, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Skill created');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewSkill({
      name: '', description: '', type: 'template', content: '{\n  \n}',
      system_prompt: '', model_override: '', temperature: 0.7, max_tokens: 1024, ai_provider_id: '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this skill?')) return;
    try {
      await skillsApi.delete(id);
      setSkills(prev => prev.filter(s => s.id !== id));
      toast.success('Skill deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleExport = (skill: Skill) => {
    const json = skillsApi.exportJson(skill);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skill.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Skill exported');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const skillData = skillsApi.importJson(text);
        const skill = await skillsApi.create(skillData);
        setSkills(prev => [skill, ...prev]);
        toast.success('Skill imported');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Import failed');
      }
    };
    input.click();
  };

  const handleApply = (skill: Skill) => {
    const params = new URLSearchParams();
    if (skill.content.niche) params.set('niche', String(skill.content.niche));
    if (skill.content.language) params.set('language', String(skill.content.language));
    if (skill.content.visual_style) params.set('visual_style', String(skill.content.visual_style));
    if (skill.content.voice) params.set('voice', String(skill.content.voice));
    if (skill.content.music_style) params.set('music_style', String(skill.content.music_style));
    if (skill.system_prompt) params.set('skill_id', skill.id);
    navigate(`/create-series?${params.toString()}`);
  };

  const hasAiConfig = (type: string) => ['ai_prompt', 'prompt_pack', 'template', 'style'].includes(type);

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Skills</h1>
          <p className="text-xs text-muted-foreground mt-1">Upload, manage, and apply content skills with AI configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleImport}>
            <Upload size={12} className="mr-1.5" />
            Import
          </Button>
          <Button size="sm" className="h-8 text-xs gradient-bg border-0 text-white font-semibold" onClick={() => setShowCreate(true)}>
            <Plus size={12} className="mr-1.5" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-colors capitalize',
              filter === f ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
            )}
          >
            {f === 'prompt_pack' ? 'Prompt Packs' : f === 'ai_prompt' ? 'AI Prompts' : f === 'brand_kit' ? 'Brand Kits' : f}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">Create New Skill</Label>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name</Label>
                <Input value={newSkill.name} onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))} placeholder="My Skill Pack" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Type</Label>
                <select value={newSkill.type} onChange={e => setNewSkill(p => ({ ...p, type: e.target.value as Skill['type'] }))}
                  className="w-full h-9 text-sm border-2 border-border rounded-lg px-3 bg-background">
                  <option value="template">Template</option>
                  <option value="prompt_pack">Prompt Pack</option>
                  <option value="style">Style</option>
                  <option value="niche">Niche</option>
                  <option value="ai_prompt">AI Prompt</option>
                  <option value="voice_style">Voice Style</option>
                  <option value="brand_kit">Brand Kit</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</Label>
              <Input value={newSkill.description || ''} onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))} placeholder="What this skill does..." className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Content (JSON)</Label>
              <textarea value={newSkill.content} onChange={e => setNewSkill(p => ({ ...p, content: e.target.value }))}
                className="w-full h-32 p-3 text-xs font-mono bg-muted/30 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {/* AI Configuration Section */}
            {hasAiConfig(newSkill.type) && (
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={14} className="text-primary" />
                  <Label className="text-xs font-bold">AI Configuration</Label>
                  <Badge className="text-[8px] font-bold border-0 bg-primary/10 text-primary">Optional</Badge>
                </div>
                <div>
                  <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">System Prompt</Label>
                  <textarea value={newSkill.system_prompt} onChange={e => setNewSkill(p => ({ ...p, system_prompt: e.target.value }))}
                    placeholder="You are a viral content writer who specializes in..."
                    className="w-full h-24 p-3 text-xs font-mono bg-muted/30 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Provider</Label>
                    <select value={newSkill.ai_provider_id} onChange={e => setNewSkill(p => ({ ...p, ai_provider_id: e.target.value }))}
                      className="w-full h-8 text-xs border border-border rounded-md px-2 bg-background">
                      <option value="">Default (auto)</option>
                      {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.provider})</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Model Override</Label>
                    <Input value={newSkill.model_override} onChange={e => setNewSkill(p => ({ ...p, model_override: e.target.value }))}
                      placeholder="e.g. gpt-4o" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Temperature</Label>
                    <Input type="number" min="0" max="2" step="0.1" value={newSkill.temperature}
                      onChange={e => setNewSkill(p => ({ ...p, temperature: Number(e.target.value) }))}
                      className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Max Tokens</Label>
                    <Input type="number" min="100" max="8000" step="100" value={newSkill.max_tokens}
                      onChange={e => setNewSkill(p => ({ ...p, max_tokens: Number(e.target.value) }))}
                      className="h-8 text-xs" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-xs gradient-bg border-0 text-white font-semibold" onClick={handleCreate} disabled={creating || !newSkill.name.trim()}>
                {creating ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Plus size={12} className="mr-1.5" />}
                Create Skill
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package size={32} className="text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No skills yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a skill or import one to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map(skill => {
            const config = TYPE_CONFIG[skill.type] || TYPE_CONFIG.template;
            const Icon = config.icon;
            return (
              <Card key={skill.id} className="border border-border shadow-none hover:border-primary/30 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.color)}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">{skill.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge className={cn('text-[8px] font-bold border-0', config.color)}>{config.label}</Badge>
                          {skill.system_prompt && (
                            <Badge className="text-[8px] font-bold border-0 bg-primary/10 text-primary">AI</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {skill.is_public ? <Globe size={12} className="text-green-500" /> : <Lock size={12} className="text-muted-foreground" />}
                    </div>
                  </div>
                  {skill.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
                  )}
                  {skill.system_prompt && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2 italic bg-muted/30 px-2 py-1 rounded">
                      "{skill.system_prompt.slice(0, 80)}..."
                    </p>
                  )}
                  <div className="flex items-center gap-1 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] font-semibold flex-1" onClick={() => handleApply(skill)}>
                      <Sparkles size={10} className="mr-1" />
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleExport(skill)} title="Export JSON">
                      <Download size={12} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(skill.id)} title="Delete">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
