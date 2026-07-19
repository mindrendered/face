import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { seriesApi, scheduledPostsApi } from '@/services/api';
import type { Series, ScheduledPost } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Instagram, Youtube, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = ['06:00','07:00','08:00','09:00','10:00','12:00','15:00','18:00','20:00','21:00','22:00'];
const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-primary/10 text-primary',
  posting:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  posted:   'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  failed:   'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  cancelled:'bg-muted text-muted-foreground',
};
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={10} />,
  youtube:   <Youtube size={10} />,
};

// Generate next 30 days calendar
function getCalendarDays() {
  const days: Date[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function groupPostsByDate(posts: ScheduledPost[]) {
  const map: Record<string, ScheduledPost[]> = {};
  for (const p of posts) {
    const key = p.scheduled_at.split('T')[0];
    if (!map[key]) map[key] = [];
    map[key].push(p);
  }
  return map;
}

export default function SchedulePage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [saving, setSaving] = useState<string | null>(null);
  const navigate = useNavigate();

  const calendarDays = getCalendarDays();
  const postsByDate = groupPostsByDate(posts);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p] = await Promise.all([seriesApi.list(), scheduledPostsApi.list(30)]);
        setSeries(s.filter(x => x.status !== 'archived'));
        setPosts(p);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load schedule data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateSchedule = async (seriesId: string, field: string, value: string | string[]) => {
    setSaving(seriesId);
    try {
      await seriesApi.update(seriesId, { [field]: value });
      setSeries(prev => prev.map(s => s.id === seriesId ? { ...s, [field]: value } : s));
      toast.success('Schedule saved');
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(null);
    }
  };

  const toggleDay = (s: Series, day: string) => {
    const days = s.posting_days || [];
    const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    updateSchedule(s.id, 'posting_days', next);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">Set posting times for each series.</p>
      </div>

      {series.length === 0 ? (
        <Card className="border border-border shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center">
              <Calendar size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-base font-bold">No series yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create a series to set up a posting schedule.</p>
            </div>
            <Button size="sm" className="gradient-bg border-0 text-white btn-glow font-semibold" onClick={() => navigate('/create-series')}>
              <Plus size={13} className="mr-1.5" />Create series
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Per-series schedule settings */}
          <div className="space-y-4">
            {series.map(s => (
              <Card key={s.id} className="border border-border shadow-none">
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shrink-0">
                        <Calendar size={14} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-bold truncate">{s.name}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{s.niche}</p>
                      </div>
                    </div>
                    <Badge
                      variant={s.status === 'active' ? 'default' : 'secondary'}
                      className={`text-[10px] shrink-0 font-semibold ${s.status === 'active' ? 'gradient-bg border-0 text-white' : ''}`}
                    >
                      {s.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frequency</Label>
                      <Select
                        value={s.posting_frequency}
                        onValueChange={val => updateSchedule(s.id, 'posting_frequency', val)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3x_week">3× per week (~12/month)</SelectItem>
                          <SelectItem value="daily">Every day (~30/month)</SelectItem>
                          <SelectItem value="pro">Max output (~60/month)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post time</Label>
                      <Select
                        value={s.posting_time || '09:00'}
                        onValueChange={val => updateSchedule(s.id, 'posting_time', val)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posting days</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS.map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(s, day)}
                          disabled={saving === s.id}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            (s.posting_days || []).includes(day)
                              ? 'border-primary bg-primary/8 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    {saving === s.id && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> Saving…
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Calendar */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-sm font-bold">Upcoming 30 days</CardTitle>
                <Select value={selectedSeries} onValueChange={setSelectedSeries}>
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder="All series" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All series</SelectItem>
                    {series.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-1 min-w-[420px]">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                  {(() => {
                    const firstDow = (calendarDays[0].getDay() + 6) % 7;
                    return Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />);
                  })()}
                  {calendarDays.map(day => {
                    const key = day.toISOString().split('T')[0];
                    const dayPosts = (postsByDate[key] || []).filter(
                      p => selectedSeries === 'all' || p.series_id === selectedSeries
                    );
                    const isToday = key === today;
                    return (
                      <div
                        key={key}
                        className={cn(
                          'rounded-lg border p-1.5 min-h-[52px] text-[10px] transition-colors',
                          isToday ? 'border-primary bg-primary/5' : 'border-border',
                          dayPosts.length > 0 ? 'bg-muted/30' : ''
                        )}
                      >
                        <div className={cn('font-bold mb-1', isToday ? 'text-primary' : 'text-foreground')}>
                          {day.getDate()}
                        </div>
                        {dayPosts.slice(0, 2).map(p => (
                          <div key={p.id} className={cn('rounded px-1 py-0.5 mb-0.5 flex items-center gap-0.5 truncate', STATUS_COLORS[p.status] || 'bg-muted')}>
                            {PLATFORM_ICONS[p.platform]}
                            <span className="truncate">{p.status}</span>
                          </div>
                        ))}
                        {dayPosts.length > 2 && (
                          <div className="text-muted-foreground font-semibold">+{dayPosts.length - 2}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {posts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center">
                    <Clock size={18} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold">No scheduled posts yet</p>
                  <p className="text-xs text-muted-foreground">Enable auto-posting in your series settings.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
