import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { seriesApi } from '@/services/api';
import type { Series } from '@/types/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Users, Eye, Clock, AlertTriangle, RefreshCw, BarChart2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar
} from 'recharts';

const IG_THRESHOLDS = { followers: 10000, views: 500000 };
const YT_THRESHOLDS = { subscribers: 1000, watch_hours: 4000 };

interface AnalyticsRow {
  id: string;
  series_id: string | null;
  platform: 'instagram' | 'youtube';
  recorded_date: string;
  views: number;
  followers: number;
  engagement_rate: number;
  likes: number;
  comments: number;
  shares: number;
  watch_hours: number;
}

function StatCard({ label, value, icon, sub, delta }: {
  label: string; value: string | number; icon: React.ReactNode; sub?: string; delta?: number;
}) {
  return (
    <Card className="border border-border shadow-none card-hover">
      <CardContent className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
            {icon}
          </div>
          {delta !== undefined && delta !== 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-green-50 text-green-600' : 'bg-destructive/8 text-destructive'}`}>
              {delta > 0 ? '+' : ''}{delta.toLocaleString()}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MonetizationBar({ label, current, target, unit }: { label: string; current: number; target: number; unit: string }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className={pct >= 80 ? 'text-primary font-bold' : 'text-muted-foreground font-medium'}>
          {current.toLocaleString()} / {target.toLocaleString()} {unit} &nbsp;
          <span className={pct >= 80 ? 'text-primary' : 'text-muted-foreground'}>({pct}%)</span>
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      {pct >= 80 && pct < 100 && (
        <p className="text-[11px] text-primary font-semibold flex items-center gap-1">
          <AlertTriangle size={10} />Almost there — keep posting!
        </p>
      )}
      {pct >= 100 && (
        <p className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
          <TrendingUp size={10} />Monetization threshold reached!
        </p>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AnalyticsRow[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [platform, setPlatform] = useState<'instagram' | 'youtube'>('instagram');
  const [range, setRange] = useState<'7' | '14' | '30'>('30');
  const [seriesFilter, setSeriesFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    const [{ data: rows }, seriesList] = await Promise.all([
      supabase
        .from('analytics')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_date', { ascending: true })
        .limit(200),
      seriesApi.list(),
    ]);
    setRecords((rows ?? []) as AnalyticsRow[]);
    setSeries(seriesList.filter(s => s.status !== 'archived'));
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const cutoff = new Date(Date.now() - parseInt(range) * 86400000).toISOString().split('T')[0];
    return records.filter(r =>
      r.platform === platform &&
      r.recorded_date >= cutoff &&
      (seriesFilter === 'all' || r.series_id === seriesFilter)
    );
  }, [records, platform, range, seriesFilter]);

  const chartData = useMemo(() => {
    // Aggregate by date in case multiple series on same day
    const byDate = new Map<string, { views: number; followers: number; engagement: number; watch_hours: number; n: number }>();
    for (const r of filtered) {
      const existing = byDate.get(r.recorded_date) ?? { views: 0, followers: 0, engagement: 0, watch_hours: 0, n: 0 };
      byDate.set(r.recorded_date, {
        views: existing.views + r.views,
        followers: Math.max(existing.followers, r.followers),
        engagement: existing.engagement + r.engagement_rate,
        watch_hours: existing.watch_hours + r.watch_hours,
        n: existing.n + 1,
      });
    }
    return Array.from(byDate.entries()).map(([date, v]) => ({
      date: date.slice(5),
      views: v.views,
      followers: v.followers,
      engagement: parseFloat((v.engagement / Math.max(1, v.n)).toFixed(2)),
      watch_hours: parseFloat(v.watch_hours.toFixed(1)),
    }));
  }, [filtered]);

  // Per-series breakdown
  const seriesBreakdown = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const bySeries = new Map<string, { views: number; followers: number; name: string }>();
    for (const r of records.filter(r => r.platform === platform && r.recorded_date >= cutoff && r.series_id)) {
      const existing = bySeries.get(r.series_id!) ?? { views: 0, followers: 0, name: '' };
      const s = series.find(s => s.id === r.series_id);
      bySeries.set(r.series_id!, {
        views: existing.views + r.views,
        followers: Math.max(existing.followers, r.followers),
        name: s?.name ?? 'Unknown series',
      });
    }
    return Array.from(bySeries.entries()).map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.views - a.views);
  }, [records, platform, series]);

  const latest = chartData[chartData.length - 1];
  const prev7 = chartData[Math.max(0, chartData.length - 8)];
  const viewDelta = latest && prev7 ? latest.views - prev7.views : 0;
  const followerDelta = latest && prev7 ? latest.followers - prev7.followers : 0;

  const latestIg = records.filter(r => r.platform === 'instagram').slice(-1)[0];
  const latestYt = records.filter(r => r.platform === 'youtube').slice(-1)[0];

  const noData = !loading && chartData.length === 0;

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your growth and monetization progress.</p>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 border border-border" onClick={load} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={platform} onValueChange={v => setPlatform(v as 'instagram' | 'youtube')}>
          <SelectTrigger className="h-9 text-xs w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instagram">Instagram Reels</SelectItem>
            <SelectItem value="youtube">YouTube Shorts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={v => setRange(v as '7' | '14' | '30')}>
          <SelectTrigger className="h-9 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        {series.length > 0 && (
          <Select value={seriesFilter} onValueChange={setSeriesFilter}>
            <SelectTrigger className="h-9 text-xs w-44">
              <SelectValue placeholder="All series" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All series</SelectItem>
              {series.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {noData ? (
        <Card className="border border-border shadow-none">
          <CardContent className="px-5 py-16 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center">
              <BarChart2 size={28} className="text-primary" />
            </div>
            <div>
              <p className="text-base font-bold">No analytics data yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Analytics will appear here once your videos have been posted and start accumulating views.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total views" value={latest?.views ?? 0} delta={viewDelta}
              icon={<Eye size={16} className="text-primary" />} />
            <StatCard label={platform === 'youtube' ? 'Subscribers' : 'Followers'} value={latest?.followers ?? 0} delta={followerDelta}
              icon={<Users size={16} className="text-primary" />} />
            <StatCard label="Engagement rate" value={`${(latest?.engagement ?? 0).toFixed(1)}%`}
              icon={<TrendingUp size={16} className="text-primary" />} />
            {platform === 'youtube'
              ? <StatCard label="Watch hours" value={Math.round(latest?.watch_hours ?? 0)} icon={<Clock size={16} className="text-primary" />} />
              : <StatCard label="Data points" value={filtered.length} icon={<TrendingUp size={16} className="text-primary" />} />
            }
          </div>

          {/* Growth chart */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-4">
              <CardTitle className="text-sm font-bold">Growth over time</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--border))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--border))" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid hsl(var(--border))', boxShadow: 'none' }} />
                    <Legend layout="horizontal" wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
                    <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Views" />
                    <Line type="monotone" dataKey="followers" stroke="hsl(215 14% 43%)" strokeWidth={2} dot={false} name={platform === 'youtube' ? 'Subscribers' : 'Followers'} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Engagement chart */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-4">
              <CardTitle className="text-sm font-bold">Engagement rate (%)</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--border))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--border))" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid hsl(var(--border))', boxShadow: 'none' }} />
                    <Line type="monotone" dataKey="engagement" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} name="Engagement %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Per-series breakdown */}
          {seriesBreakdown.length > 0 && (
            <Card className="border border-border shadow-none">
              <CardHeader className="px-5 pt-5 pb-4">
                <CardTitle className="text-sm font-bold">Series breakdown (last 30 days)</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="w-full min-w-0 overflow-hidden mb-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={seriesBreakdown} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--border))" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid hsl(var(--border))', boxShadow: 'none' }} />
                      <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Views" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {seriesBreakdown.map(s => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                      <p className="text-sm font-semibold flex-1 min-w-0 truncate">{s.name}</p>
                      <Badge className="text-[10px] gradient-bg border-0 text-white font-bold shrink-0">{s.views.toLocaleString()} views</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Monetization trackers — always shown */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-4">
          <CardTitle className="text-sm font-bold">Monetization progress</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Track how close you are to Instagram &amp; YouTube monetization.</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Instagram</p>
            <MonetizationBar label="Followers toward Reel monetization" current={latestIg?.followers ?? 0} target={IG_THRESHOLDS.followers} unit="followers" />
            <MonetizationBar label="Total views" current={latestIg?.views ?? 0} target={IG_THRESHOLDS.views} unit="views" />
          </div>
          <div className="border-t border-border pt-5 space-y-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">YouTube</p>
            <MonetizationBar label="Subscribers toward YPP" current={latestYt?.followers ?? 0} target={YT_THRESHOLDS.subscribers} unit="subscribers" />
            <MonetizationBar label="Watch hours toward YPP" current={Math.round(latestYt?.watch_hours ?? 0)} target={YT_THRESHOLDS.watch_hours} unit="hours" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
