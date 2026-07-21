import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { sqlQueriesApi } from '@/services/api';
import type { SqlQuery } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Loader2, ArrowLeft, Send, Check, X, Play, Terminal,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, RotateCw, Download, Trash2, Share2, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
  executed: { label: 'Executed', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: Play },
  failed: { label: 'Failed', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: AlertCircle },
};

const TABLES = [
  'profiles', 'series', 'videos', 'social_connections', 'social_credentials',
  'analytics', 'scheduled_posts', 'notifications', 'platform_settings', 'payments', 'sql_queries',
];

function exportToCsv(data: unknown, filename: string) {
  if (!Array.isArray(data) || data.length === 0) {
    toast.error('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const escape = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => escape((row as Record<string, unknown>)[h])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${data.length} rows to CSV`);
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error('Failed to copy');
  }
}

function ShareMenu({ query, result, status, creatorEmail, createdAt, rowCount }: {
  query: string;
  result: unknown;
  status: string;
  creatorEmail?: string | null;
  createdAt: string;
  rowCount?: number | null;
}) {
  const [open, setOpen] = useState(false);

  const copySql = () => { copyToClipboard(query, 'SQL'); setOpen(false); };

  const copyResultsJson = () => {
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    copyToClipboard(text, 'Results (JSON)');
    setOpen(false);
  };

  const copyResultsCsv = () => {
    if (!Array.isArray(result) || result.length === 0) { toast.error('No tabular data to copy'); setOpen(false); return; }
    const headers = Object.keys(result[0]);
    const csv = [headers.join(','), ...result.map(row => headers.map(h => String((row as Record<string, unknown>)[h] ?? '')).join(','))].join('\n');
    copyToClipboard(csv, 'Results (CSV)');
    setOpen(false);
  };

  const copySummary = () => {
    const lines = [
      `SQL Query:`,
      query,
      ``,
      `Status: ${status}`,
      `Created by: ${creatorEmail || 'Unknown'}`,
      `Created at: ${new Date(createdAt).toLocaleString()}`,
    ];
    if (rowCount != null) lines.push(`Rows: ${rowCount}`);
    if (Array.isArray(result) && result.length > 0) {
      lines.push(``, `Results:`, JSON.stringify(result, null, 2));
    }
    copyToClipboard(lines.join('\n'), 'Query summary');
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] font-semibold"
        onClick={() => setOpen(!open)}
      >
        <Share2 size={10} className="mr-1" />
        Share
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-background border border-border rounded-lg shadow-lg py-1">
            <button onClick={copySql} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left">
              <Copy size={12} className="text-muted-foreground" />
              Copy SQL
            </button>
            {Array.isArray(result) && result.length > 0 && (
              <>
                <button onClick={copyResultsJson} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left">
                  <Copy size={12} className="text-muted-foreground" />
                  Copy Results (JSON)
                </button>
                <button onClick={copyResultsCsv} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left">
                  <Copy size={12} className="text-muted-foreground" />
                  Copy Results (CSV)
                </button>
              </>
            )}
            <div className="border-t border-border my-1" />
            <button onClick={copySummary} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left">
              <Share2 size={12} className="text-muted-foreground" />
              Copy Full Summary
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function SqlEditorPage() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [queries, setQueries] = useState<SqlQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const selectedQuery = useMemo(() => queries.find(q => q.id === selectedQueryId) ?? null, [queries, selectedQueryId]);
  const [filter, setFilter] = useState<string>('all');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, authLoading, navigate]);

  const loadQueries = useCallback(async () => {
    try {
      const data = await sqlQueriesApi.list(filter === 'all' ? undefined : filter);
      setQueries(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load queries');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadQueries(); }, [loadQueries]);

  const handleSubmit = async () => {
    if (!query.trim()) return;
    setSubmitting(true);
    try {
      const created = await sqlQueriesApi.submit(query.trim());
      setQueries(prev => [created, ...prev]);
      setQuery('');
      toast.success('Query submitted for approval');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await sqlQueriesApi.approve(id);
      setQueries(prev => prev.map(q => q.id === id ? { ...q, status: 'approved', approved_by: user?.id ?? null } : q));
      if (selectedQuery?.id === id) { /* derived from queries, no separate update needed */ }
      toast.success('Query approved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      await sqlQueriesApi.reject(id, rejectReason || undefined);
      setQueries(prev => prev.map(q => q.id === id ? { ...q, status: 'rejected', error_message: rejectReason || null } : q));
      if (selectedQuery?.id === id) { /* derived from queries */ }
      setRejectReason('');
      toast.success('Query rejected');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setRejectingId(null);
    }
  };

  const handleExecute = async (id: string) => {
    setExecutingId(id);
    try {
      const result = await sqlQueriesApi.execute(id);
      setQueries(prev => prev.map(q => q.id === id ? { ...q, status: 'executed', result: result.result, row_count: result.row_count } : q));
      if (selectedQuery?.id === id) { /* derived from queries */ }
      toast.success(`Query executed — ${result.row_count ?? 0} rows`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Execute failed');
    } finally {
      setExecutingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this query from history?')) return;
    try {
      await sqlQueriesApi.delete(id);
      setQueries(prev => prev.filter(q => q.id !== id));
      if (selectedQuery?.id === id) setSelectedQueryId(null);
      toast.success('Query deleted');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );

  if (!isAdmin) return null;

  const pending = queries.filter(q => q.status === 'pending');
  const history: SqlQuery[] = queries.filter(q => q.status !== 'pending');

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Left: Editor + Pending */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin')}>
              <ArrowLeft size={16} />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                <Terminal size={14} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold">SQL Editor</h1>
                <p className="text-[10px] text-muted-foreground">Write, approve, and execute queries</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadQueries} aria-label="Refresh">
            <RefreshCw size={14} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Query Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">Write SQL</Label>
              <div className="flex gap-1 flex-wrap">
                {TABLES.map(t => (
                  <button
                    key={t}
                    onClick={() => setQuery(prev => prev ? `${prev}\nSELECT * FROM ${t} LIMIT 10;` : `SELECT * FROM ${t} LIMIT 10;`)}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border hover:bg-muted/50 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="SELECT * FROM profiles LIMIT 10;"
              className="w-full h-48 p-4 text-sm font-mono bg-muted/30 border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Ctrl+Enter to submit</p>
              <Button
                size="sm"
                className="h-8 text-xs gradient-bg border-0 text-white font-semibold"
                onClick={handleSubmit}
                disabled={!query.trim() || submitting}
              >
                {submitting ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Send size={12} className="mr-1.5" />}
                Submit for Approval
              </Button>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-yellow-600" />
              <Label className="text-xs font-bold">Pending Approval ({pending.length})</Label>
            </div>
            {pending.length === 0 ? (
              <Card className="border border-border shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 size={20} className="text-green-500 mb-2" />
                  <p className="text-xs text-muted-foreground">No pending queries</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pending.map(q => {
                  const isOwn = q.created_by === user?.id;
                  return (
                    <Card
                      key={q.id}
                      className={cn(
                        'border shadow-none cursor-pointer transition-colors hover:border-primary/30',
                        selectedQuery?.id === q.id ? 'border-primary/50 bg-primary/5' : 'border-border'
                      )}
                      onClick={() => setSelectedQueryId(q.id)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <pre className="text-xs font-mono text-foreground/80 line-clamp-3 whitespace-pre-wrap break-all flex-1">{q.query}</pre>
                          <Badge className={cn('text-[9px] font-bold border-0 shrink-0', STATUS_CONFIG[q.status]?.color)}>
                            {STATUS_CONFIG[q.status]?.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] text-muted-foreground space-x-2">
                            <span>{q.creator_email || 'Unknown'}</span>
                            <span>{new Date(q.created_at).toLocaleString()}</span>
                          </div>
                          {!isOwn && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] font-semibold text-green-600 hover:text-green-700"
                                onClick={e => { e.stopPropagation(); handleApprove(q.id); }}
                              >
                                <Check size={11} className="mr-1" /> Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] font-semibold text-red-600 hover:text-red-700"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (rejectingId === q.id) {
                                    handleReject(q.id);
                                  } else {
                                    setRejectingId(q.id);
                                  }
                                }}
                              >
                                <X size={11} className="mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                          {isOwn && (
                            <span className="text-[10px] text-muted-foreground italic">Your query</span>
                          )}
                        </div>
                        {rejectingId === q.id && (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Input
                              placeholder="Rejection reason (optional)"
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              className="h-7 text-xs flex-1"
                              onKeyDown={e => { if (e.key === 'Enter') handleReject(q.id); }}
                              autoFocus
                            />
                            <Button size="sm" className="h-7 text-[10px]" onClick={() => handleReject(q.id)}>
                              Confirm
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Tabs — Detail / History */}
      <div className="w-[480px] shrink-0 flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-border shrink-0">
          <button
            onClick={() => { if (selectedQuery) setSelectedQueryId(null); }}
            className={cn(
              'flex-1 text-xs font-bold py-3 transition-colors border-b-2',
              !selectedQuery ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Query History ({history.length})
          </button>
          {selectedQuery && (
            <button className="flex-1 text-xs font-bold py-3 border-b-2 border-primary text-primary">
              Detail
            </button>
          )}
        </div>

        {/* Detail Panel */}
        {selectedQuery ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Badge className={cn('text-[10px] font-bold border-0', STATUS_CONFIG[selectedQuery.status]?.color)}>
                  {STATUS_CONFIG[selectedQuery.status]?.label}
                </Badge>
                {selectedQuery.row_count != null && (
                  <span className="text-[10px] text-muted-foreground">{selectedQuery.row_count} rows</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {selectedQuery.status === 'approved' && (
                  <Button
                    size="sm"
                    className="h-7 text-[10px] font-semibold gradient-bg border-0 text-white"
                    onClick={() => handleExecute(selectedQuery.id)}
                    disabled={executingId === selectedQuery.id}
                  >
                    {executingId === selectedQuery.id ? <Loader2 size={10} className="mr-1 animate-spin" /> : <Play size={10} className="mr-1" />}
                    Execute
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] font-semibold"
                  onClick={() => { setQuery(selectedQuery.query); setSelectedQueryId(null); }}
                  title="Load into editor to re-run"
                >
                  <RotateCw size={10} className="mr-1" />
                  Re-run
                </Button>
                {selectedQuery.result != null && Array.isArray(selectedQuery.result) && selectedQuery.result.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-semibold"
                    onClick={() => exportToCsv(selectedQuery.result, `query-${selectedQuery.id.slice(0, 8)}.csv`)}
                  >
                    <Download size={10} className="mr-1" />
                    CSV
                  </Button>
                )}
                <ShareMenu
                  query={selectedQuery.query}
                  result={selectedQuery.result}
                  status={selectedQuery.status}
                  creatorEmail={selectedQuery.creator_email}
                  createdAt={selectedQuery.created_at}
                  rowCount={selectedQuery.row_count}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] font-semibold text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedQuery.id)}
                >
                  <Trash2 size={10} className="mr-1" />
                  Delete
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedQueryId(null)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Query */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Query</Label>
                <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 whitespace-pre-wrap break-all">
                  {selectedQuery.query}
                </pre>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                  <p className="text-muted-foreground font-semibold">Created by</p>
                  <p className="font-bold mt-0.5">{selectedQuery.creator_email || 'Unknown'}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                  <p className="text-muted-foreground font-semibold">Created at</p>
                  <p className="font-bold mt-0.5">{new Date(selectedQuery.created_at).toLocaleString()}</p>
                </div>
                {selectedQuery.approved_by && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <p className="text-muted-foreground font-semibold">Approved by</p>
                    <p className="font-bold mt-0.5">{selectedQuery.approved_by}</p>
                  </div>
                )}
                {selectedQuery.executed_at && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <p className="text-muted-foreground font-semibold">Executed at</p>
                    <p className="font-bold mt-0.5">{new Date(selectedQuery.executed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {selectedQuery.error_message && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-red-600 uppercase">Error</Label>
                  <pre className="text-xs font-mono bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 text-red-700 dark:text-red-400 whitespace-pre-wrap break-all">
                    {selectedQuery.error_message}
                  </pre>
                </div>
              )}

              {/* Result */}
              {selectedQuery.result != null && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Result</Label>
                  <pre className="text-xs font-mono bg-muted/30 border border-border rounded-xl p-4 whitespace-pre-wrap break-all max-h-96 overflow-auto">
                    {typeof selectedQuery.result === 'string'
                      ? selectedQuery.result
                      : JSON.stringify(selectedQuery.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* History List with inline result previews */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border shrink-0">
              {['all', 'executed', 'approved', 'rejected', 'failed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'text-[9px] font-semibold px-2 py-1 rounded-md transition-colors capitalize',
                    filter === f ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Terminal size={20} className="text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">No query history yet</p>
                </div>
              ) : (
                history.map((q: SqlQuery) => {
                  const Icon = STATUS_CONFIG[q.status]?.icon || Clock;
                  const hasResult = q.result != null;
                  const selectedId = (selectedQuery as SqlQuery | null)?.id ?? null;
                  const isSelected = selectedId !== null && selectedId === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQueryId(q.id)}
                      className={cn(
                        'w-full text-left border-b border-border transition-colors hover:bg-muted/30',
                        isSelected ? 'bg-primary/5' : ''
                      )}
                    >
                      {/* Header row */}
                      <div className="flex items-start gap-2 px-4 py-3">
                        <Icon size={12} className={cn('mt-0.5 shrink-0', {
                          'text-yellow-600': q.status === 'pending',
                          'text-green-600': q.status === 'approved',
                          'text-red-600': q.status === 'rejected' || q.status === 'failed',
                          'text-blue-600': q.status === 'executed',
                        })} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono truncate">{q.query}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn('text-[8px] font-bold border-0', STATUS_CONFIG[q.status]?.color)}>
                              {STATUS_CONFIG[q.status]?.label}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">
                              {q.creator_email || 'Unknown'}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(q.created_at).toLocaleString()}
                            </span>
                            {q.row_count != null && (
                              <span className="text-[9px] text-muted-foreground">{q.row_count} rows</span>
                            )}
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="shrink-0 flex items-center gap-0.5">
                          {hasResult && Array.isArray(q.result) && q.result.length > 0 && (
                            <button
                              onClick={e => { e.stopPropagation(); exportToCsv(q.result, `query-${q.id.slice(0, 8)}.csv`); }}
                              className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              title="Export to CSV"
                            >
                              <Download size={12} />
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setQuery(q.query); setSelectedQueryId(null); }}
                            className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Re-run this query"
                          >
                            <RotateCw size={12} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const lines = [`SQL: ${q.query}`, `Status: ${q.status}`, `By: ${q.creator_email || 'Unknown'}`];
                              if (q.row_count != null) lines.push(`Rows: ${q.row_count}`);
                              if (hasResult) lines.push(`Results: ${typeof q.result === 'string' ? q.result : JSON.stringify(q.result)}`);
                              copyToClipboard(lines.join('\n'), 'Query summary');
                            }}
                            className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Copy summary to clipboard"
                          >
                            <Share2 size={12} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(q.id); }}
                            className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete query"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Inline result preview for executed queries */}
                      {hasResult && q.status === 'executed' && (
                        <div className="px-4 pb-3">
                          <pre className="text-[10px] font-mono bg-muted/30 border border-border rounded-lg p-2.5 max-h-24 overflow-auto whitespace-pre-wrap break-all text-foreground/70">
                            {typeof q.result === 'string'
                              ? q.result
                              : JSON.stringify(q.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Inline error preview for failed queries */}
                      {q.error_message && (
                        <div className="px-4 pb-3">
                          <pre className="text-[10px] font-mono bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-2.5 max-h-24 overflow-auto whitespace-pre-wrap break-all text-red-600 dark:text-red-400">
                            {q.error_message}
                          </pre>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
