import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, Download, FileArchive, FileText, History, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { ApiError, CsvValidationResult, ImportResult, productImportApi, invalidateCache } from '@/lib/api';

const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const messageFor = (error: unknown) => {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to import products.';
  if (status === 413) return 'This CSV is too large. Please choose a smaller file.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
};
const statusVariant = (status: string) => status.includes('ERROR') || status === 'FAILED' ? 'destructive' : status.includes('WARNING') ? 'warning' : 'success';

export const AdminProductImport: React.FC = () => {
  const navigate = useNavigate(); const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const zipInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null); const [validation, setValidation] = React.useState<CsvValidationResult | null>(null);
  const [zipFile, setZipFile] = React.useState<File | null>(null); const [result, setResult] = React.useState<ImportResult | null>(null); const [busy, setBusy] = React.useState<'validate' | 'import' | 'template' | null>(null); const [error, setError] = React.useState<string | null>(null); const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (!result || result.status !== 'PROCESSING' || !result.runId) return;

    let active = true;
    const poll = async () => {
      try {
        const run = await productImportApi.getRun(result.runId);
        if (!active) return;

        const nextResult: ImportResult = {
          runId: run.id,
          status: run.status as ImportResult['status'],
          totalRows: run.totalRows,
          successRows: run.successRows,
          warningRows: run.warningRows,
          errorRows: run.errorRows,
          createdProducts: run.successRows + run.warningRows,
          updatedProducts: 0,
          rowResults: run.rowResults ?? [],
          imagesUploaded: run.rowResults?.reduce((count, row) => count + (row.imagesUploaded || 0), 0),
          message: result.message,
        };
        setResult(nextResult);
      } catch (e) {
        if (!active) return;
        setError(messageFor(e));
      }
    };

    void poll();
    const interval = window.setInterval(() => { void poll(); }, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [result?.runId, result?.status]);

  const chooseFile = (next: File | undefined) => { if (!next) return; if (!next.name.toLowerCase().endsWith('.csv')) { setError('Please select a CSV file.'); return; } setFile(next); setValidation(null); setResult(null); setError(null); };
  const chooseZip = (next: File | undefined) => { if (!next) return; if (!next.name.toLowerCase().endsWith('.zip')) { setError('Please select a ZIP archive containing product images.'); return; } if (next.size > 30 * 1024 * 1024) { setError('The image ZIP must be 30 MB or smaller.'); return; } setZipFile(next); setError(null); };
  const reset = () => { setFile(null); setZipFile(null); setValidation(null); setResult(null); setError(null); if (inputRef.current) inputRef.current.value = ''; if (zipInputRef.current) zipInputRef.current.value = ''; };
  const download = async () => { try { setBusy('template'); const blob = await productImportApi.downloadTemplate(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'emart-product-import-template.csv'; a.click(); URL.revokeObjectURL(url); } catch (e) { setError(messageFor(e)); } finally { setBusy(null); } };
  const validate = async () => { if (!file) return; try { setBusy('validate'); setError(null); setResult(null); setValidation(await productImportApi.validate(file)); } catch (e) { setError(messageFor(e)); } finally { setBusy(null); } };
  const importCsv = async () => { if (!file || !validation || validation.validRows + validation.warningRows === 0) return; try { setBusy('import'); setError(null); const next = await productImportApi.importCsv(file, zipFile || undefined) as ImportResult & { message?: string }; setResult(next); if (next.status === 'PROCESSING') { invalidateCache.products(); const payload = next as ImportResult & { message?: string }; toast({ title: 'Import started', description: payload.message || 'Your import is being processed in the background.' }); } else { invalidateCache.products(); toast({ title: 'Import completed', description: `${next.createdProducts} product${next.createdProducts === 1 ? '' : 's'} created.` }); } } catch (e) { setError(messageFor(e)); } finally { setBusy(null); } };

  const progress = result && result.totalRows > 0 ? Math.min(100, Math.round(((result.successRows + result.warningRows + result.errorRows) / result.totalRows) * 100)) : 0;
  const processedRows = result ? result.successRows + result.warningRows + result.errorRows : 0;

  return <div className="space-y-6 max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl lg:text-3xl font-bold">Import Products</h1><p className="mt-1 text-muted-foreground">Validate a CSV before creating products in your catalog.</p></div><div className="flex gap-2"><Link to="/admin/products/import/history"><Button variant="outline" leftIcon={<History className="h-4 w-4" />}>Import History</Button></Link><Button variant="outline" isLoading={busy === 'template'} onClick={download} leftIcon={<Download className="h-4 w-4" />}>Download Template</Button></div></div>
    {error && <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {result ? <Card><CardHeader><CardTitle className="flex items-center gap-2">{result.status === 'PROCESSING' ? <><Clock3 className="h-5 w-5 text-info" />Import in progress</> : <><CheckCircle2 className="h-5 w-5 text-success" />Import completed</>}</CardTitle></CardHeader><CardContent className="space-y-5">{result.status === 'PROCESSING' ? <><div className="rounded-lg border border-info/30 bg-info/5 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-info" /><span className="font-semibold">Background import running</span></div><Badge variant="info">{progress}%</Badge></div><div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-info transition-all duration-500" style={{ width: `${progress}%` }} /></div><p className="mt-3 text-sm text-muted-foreground">{result.totalRows > 0 ? `${processedRows} of ${result.totalRows} rows processed` : (result.message || 'Waiting for the background worker to start.')}</p></div><Summary total={result.totalRows} valid={result.successRows} warnings={result.warningRows} errors={result.errorRows} /><p className="text-sm text-muted-foreground">{result.message || 'Your CSV is being processed in the background.'}</p><div className="flex flex-wrap gap-3"><Button onClick={() => navigate(`/admin/products/import/${result.runId}`)}>View live run</Button><Button variant="outline" onClick={reset}>Import Another File</Button></div></> : <><Summary total={result.totalRows} valid={result.successRows} warnings={result.warningRows} errors={result.errorRows} /><p className="text-sm text-muted-foreground">{result.createdProducts > 0 ? `${result.createdProducts} product${result.createdProducts === 1 ? '' : 's'} created.` : 'Import finished.'}</p>{(result.imagesUploaded !== undefined || result.imagesSkipped !== undefined || result.imagesInvalid !== undefined) && <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"><Stat label="Images uploaded" value={result.imagesUploaded || 0} tone="text-success" /><Stat label="Images skipped" value={result.imagesSkipped || 0} tone="text-warning-foreground" /><Stat label="Invalid images" value={result.imagesInvalid || 0} tone="text-destructive" /></div>}{result.imageWarnings && result.imageWarnings.length > 0 && <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground"><p className="font-semibold">Image warnings</p><ul className="mt-2 list-disc space-y-1 pl-5">{result.imageWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div className="flex flex-wrap gap-3"><Button onClick={() => navigate(`/admin/products/import/${result.runId}`)}>View Import Details</Button><Button variant="outline" onClick={reset}>Import Another File</Button><Button variant="ghost" onClick={() => navigate('/admin/products')}>View Products</Button></div></>}</CardContent></Card> : <>
      <Card><CardContent className="space-y-5 p-6"><input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => chooseFile(e.target.files?.[0])} /><input ref={zipInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => chooseZip(e.target.files?.[0])} /><div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }} className={`rounded-xl border-2 border-dashed p-10 text-center ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}><Upload className="mx-auto h-9 w-9 text-primary" /><p className="mt-3 font-semibold">Drop your CSV here</p><p className="mt-1 text-sm text-muted-foreground">or choose a file from your computer</p><Button className="mt-5" variant="outline" onClick={() => inputRef.current?.click()}>Choose CSV File</Button></div><FileSelection label="CSV" file={file} icon={<FileText className="h-6 w-6 text-primary" />} empty="No CSV selected" onChoose={() => inputRef.current?.click()} onRemove={() => { setFile(null); setValidation(null); if (inputRef.current) inputRef.current.value = ''; }} /><div className="rounded-lg border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">Product Images ZIP <span className="font-normal text-muted-foreground">(Optional)</span></p><p className="mt-1 text-sm text-muted-foreground">Upload a ZIP containing product images named &lt;SKU&gt;-&lt;1-5&gt;.&lt;extension&gt;.</p></div><Button variant="outline" size="sm" onClick={() => zipInputRef.current?.click()}>Choose ZIP</Button></div><div className="mt-3"><FileSelection label="Images" file={zipFile} icon={<FileArchive className="h-6 w-6 text-primary" />} empty="No ZIP selected" onChoose={() => zipInputRef.current?.click()} onRemove={() => { setZipFile(null); if (zipInputRef.current) zipInputRef.current.value = ''; }} /></div><p className="mt-3 text-xs text-muted-foreground">Examples: EM-001-1.jpg, EM-001-2.jpg, EM-001-3.png. Image 1 is primary; maximum 5 images per product. JPEG, PNG, WebP, and AVIF are supported.</p></div></CardContent></Card>
      {validation && <Card><CardHeader><CardTitle>Validation results</CardTitle></CardHeader><CardContent className="space-y-4"><Summary total={validation.totalRows} valid={validation.validRows} warnings={validation.warningRows} errors={validation.errorRows} />{zipFile && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">CSV validation is complete. Images will be processed during import.</p>}{validation.errorRows > 0 && <p className="text-sm text-warning-foreground">Rows with errors will not be imported.</p>}<RowTable rows={validation.rows} /><Button isLoading={busy === 'import'} disabled={busy === 'validate' || validation.validRows + validation.warningRows === 0} onClick={importCsv}>{busy === 'import' ? 'Importing...' : 'Import valid rows'}</Button></CardContent></Card>}
      <div className="flex justify-end"><Button isLoading={busy === 'validate'} disabled={!file || busy === 'import'} onClick={validate}>Validate CSV</Button></div>
    </>}</div>;
};
const FileSelection = ({ label, file, icon, empty, onChoose, onRemove }: { label: string; file: File | null; icon: React.ReactNode; empty: string; onChoose: () => void; onRemove: () => void }) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4"><div className="flex min-w-0 items-center gap-3">{icon}<div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="truncate font-medium">{file ? file.name : empty}</p>{file && <p className="text-sm text-muted-foreground">{formatSize(file.size)}</p>}</div></div><div className="flex gap-2">{file ? <><Button variant="outline" size="sm" onClick={onChoose}>Replace</Button><Button variant="ghost" size="icon" aria-label={`Remove ${label} file`} onClick={onRemove}><Trash2 className="h-4 w-4" /></Button></> : <Button variant="outline" size="sm" onClick={onChoose}>Choose File</Button>}</div></div>;
export const Summary = ({ total, valid, warnings, errors }: { total: number; valid: number; warnings: number; errors: number }) => <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Total rows" value={total} /><Stat label="Valid rows" value={valid} tone="text-success" /><Stat label="Warning rows" value={warnings} tone="text-warning-foreground" /><Stat label="Error rows" value={errors} tone="text-destructive" /></div>;
const Stat = ({ label, value, tone = '' }: { label: string; value: number; tone?: string }) => <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p></div>;
export const RowTable = ({ rows }: { rows: Array<{ rowNumber: number; sku?: string; rawSku?: string; status: string; errors: string[]; warnings: string[]; productId?: string; imagesUploaded?: number }> }) => <div className="max-h-96 overflow-auto rounded-lg border border-border"><table className="w-full min-w-[680px] text-sm"><thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-3">Row</th><th className="p-3">SKU</th><th className="p-3">Status</th><th className="p-3">Images</th><th className="p-3">Details</th></tr></thead><tbody>{rows.map((row) => <tr key={row.rowNumber} className="border-t border-border align-top"><td className="p-3">{row.rowNumber}</td><td className="p-3 font-mono text-xs">{row.sku || row.rawSku || '—'}</td><td className="p-3"><Badge variant={statusVariant(row.status) as any}>{row.status.replace(/_/g, ' ')}</Badge></td><td className="p-3">{row.imagesUploaded === undefined ? '—' : row.imagesUploaded}</td><td className="p-3 text-muted-foreground">{[...row.errors, ...row.warnings].join(' · ') || '—'}</td></tr>)}</tbody></table></div>;
