import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge'; import { Button } from '@/components/ui/Button'; import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'; import { ImportRunDetail, productImportApi } from '@/lib/api'; import { RowTable, Summary } from './ProductImport';
const date = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
export const AdminImportDetail: React.FC = () => { const { runId = '' } = useParams(); const navigate = useNavigate(); const [run, setRun] = React.useState<ImportRunDetail | null>(null); const [error, setError] = React.useState<string | null>(null); const [retrying, setRetrying] = React.useState(false);
  React.useEffect(() => {
    if (!runId) return;
    let active = true;
    const load = async () => {
      try {
        const next = await productImportApi.getRun(runId);
        if (active) setRun(next);
      } catch (e) {
        if (active) setError((e as Error).message || 'Could not load this import.');
      }
    };

    void load();
    if (!run || run.status !== 'PROCESSING') return () => { active = false; };
    const interval = window.setInterval(() => { void load(); }, 2000);
    return () => { active = false; window.clearInterval(interval); };
  }, [runId, run?.status]);

  const retry = async () => {
    if (!runId) return;
    try {
      setRetrying(true);
      const next = await productImportApi.retryFailedRows(runId);
      navigate(`/admin/products/import/${next.runId}`);
    } catch (e) {
      setError((e as Error).message || 'Could not retry failed rows.');
    } finally {
      setRetrying(false);
    }
  };

  if (error) return <div className="space-y-4"><Link to="/admin/products/import/history"><Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>Import History</Button></Link><div className="flex gap-2 text-destructive"><AlertCircle />{error}</div></div>; if (!run) return <p className="text-muted-foreground">Loading import details…</p>; return <div className="space-y-6 max-w-6xl"><Link to="/admin/products/import/history"><Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>Import History</Button></Link><div><h1 className="font-display text-2xl lg:text-3xl font-bold">Import Details</h1><p className="mt-1 text-muted-foreground">{run.filename}</p></div><Card><CardHeader><CardTitle className="flex items-center gap-3">Run summary <Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'destructive' : run.status === 'PROCESSING' ? 'info' : 'warning'}>{run.status.replace(/_/g, ' ')}</Badge></CardTitle></CardHeader><CardContent className="space-y-5">{run.status === 'PROCESSING' && <div className="rounded-lg border border-info/30 bg-info/5 p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-info" /><span className="font-semibold">Import still running</span></div><span className="text-sm text-muted-foreground">{run.successRows + run.warningRows + run.errorRows} / {run.totalRows} rows processed</span></div></div>}<div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-muted-foreground">Filename</span><p className="font-medium break-all">{run.filename}</p></div><div><span className="text-muted-foreground">Mode</span><p className="font-medium">{run.mode}</p></div><div><span className="text-muted-foreground">Created</span><p className="font-medium">{date(run.createdAt)}</p></div><div><span className="text-muted-foreground">Completed</span><p className="font-medium">{date(run.completedAt)}</p></div></div><Summary total={run.totalRows} valid={run.successRows} warnings={run.warningRows} errors={run.errorRows} />{run.errorRows > 0 && <Button variant="outline" isLoading={retrying} onClick={retry}>Retry failed rows</Button>}</CardContent></Card><Card><CardHeader><CardTitle>Row results</CardTitle></CardHeader><CardContent><RowTable rows={run.rowResults || []} /></CardContent></Card></div>; };
