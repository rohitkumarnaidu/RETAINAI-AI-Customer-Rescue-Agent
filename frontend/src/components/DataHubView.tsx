import React, { useEffect, useState, useMemo } from 'react';
import { getPortfolio, getCustomerTimeline, getCustomers } from '../services/api';
import { getUploads, deleteUpload, clearUploads, type UploadEntry } from '../services/uploadHistory';
import { Card, SectionHeader, SkeletonCard, ErrorState, EmptyState } from './ui';
import { CsvUpload } from './CsvUpload';
import { Database, Activity, MessageSquare, LifeBuoy, Users, Clock, Search, Folder, FolderOpen, FileSpreadsheet, Trash2, Download, Upload, Eye, ChevronRight, ChevronDown, FileText, HardDrive, Layers, X } from 'lucide-react';

type Tab = 'all' | 'customers' | 'usage' | 'support' | 'feedback';

export const DataHubView: React.FC<{ onSelectCustomer?: (id: string) => void }> = ({ onSelectCustomer }) => {
  const [tab, setTab] = useState<Tab>('all');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [timelines, setTimelines] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  // — Uploads folder structure state —
  const tenantId = (() => { try { return localStorage.getItem('retainai_tenant_id') || localStorage.getItem('retainai_tenantId') || 'demo-tenant-001'; } catch { return 'demo-tenant-001'; } })();
  const [uploads, setUploads] = useState<UploadEntry[]>(() => getUploads(tenantId));
  const [selectedId, setSelectedId] = useState<string | null>(() => getUploads(tenantId)[0]?.id || null);
  const [folderCollapsed, setFolderCollapsed] = useState(false);
  const [showUploadInline, setShowUploadInline] = useState(false);
  const [csvSearch, setCsvSearch] = useState('');
  const [csvPage, setCsvPage] = useState(1);
  const csvPageSize = 50;

  const refreshUploads = () => {
    const u = getUploads(tenantId);
    setUploads(u);
  };

  useEffect(() => {
    const handler = () => refreshUploads();
    window.addEventListener('retainai_upload', handler as EventListener);
    window.addEventListener('retainai_upload_deleted', handler as EventListener);
    window.addEventListener('retainai_uploads_cleared', handler as EventListener);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('retainai_upload', handler as EventListener);
      window.removeEventListener('retainai_upload_deleted', handler as EventListener);
      window.removeEventListener('retainai_uploads_cleared', handler as EventListener);
      window.removeEventListener('storage', handler);
    };
  }, [tenantId]);

  const usage = timelines.filter((e: any) => (e.source || '').toUpperCase().includes('USAGE'));
  const support = timelines.filter((e: any) => (e.source || '').toUpperCase().includes('SUPPORT') || (e.source || '').toUpperCase().includes('TICKET'));
  const feedback = timelines.filter((e: any) => (e.source || '').toUpperCase().includes('FEEDBACK') || (e.source || '').toUpperCase().includes('CSAT'));

  // — Synthetic folders for already-present DB data (so FILES never shows 0 when DB has data) —
  const csvEscapeSyn = (v: any) => {
    const s = String(v ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const syntheticFolders: UploadEntry[] = useMemo(() => {
    const f: UploadEntry[] = [];
    if (customers.length > 0) {
      const headers = ['name','domain','segment','industry','plan','arr','mrr','csm_name','csm_email','health_score','risk_level','renewal_date','status'];
      const rows: Record<string,string>[] = customers.map((c:any) => ({
        name: String(c.name||''), domain: String(c.domain||''), segment: String(c.segment||''), industry: String(c.industry||''), plan: String(c.plan||''),
        arr: String(c.arr??''), mrr: String(c.mrr??''), csm_name: String(c.csm_name||''), csm_email: String(c.csm_email||''), health_score: String(c.health_score??''), risk_level: String(c.risk_level||''), renewal_date: String(c.renewal_date||''), status: String(c.status||'')
      }));
      const csvText = [headers.join(','), ...rows.map(r=> headers.map(h=> csvEscapeSyn(r[h])).join(','))].join('\n');
      f.push({ id:'__db_customers__', filename:`customers_db_${customers.length}_rows.csv`, uploadDate: new Date().toISOString(), headers, rows, csvText, totalRows: rows.length, created: rows.length, skipped:0, sizeKB: csvText.length/1024, tenantId, backendResult:{synthetic:true, source:'db_customers'} } as UploadEntry);
    }
    if (usage.length > 0) {
      const headers = ['timestamp','source','title','description'];
      const rows: Record<string,string>[] = usage.map((e:any)=> ({ timestamp: String(e.timestamp||''), source: String(e.source||''), title: String(e.title||''), description: String(e.description||'') }));
      const csvText = [headers.join(','), ...rows.map(r=> headers.map(h=> csvEscapeSyn(r[h])).join(','))].join('\n');
      f.push({ id:'__db_usage__', filename:`usage_events_${usage.length}_rows.csv`, uploadDate: new Date().toISOString(), headers, rows, csvText, totalRows: rows.length, created: rows.length, skipped:0, sizeKB: csvText.length/1024, tenantId, backendResult:{synthetic:true, source:'db_usage'} } as UploadEntry);
    }
    if (support.length > 0) {
      const headers = ['timestamp','source','title','description'];
      const rows: Record<string,string>[] = support.map((e:any)=> ({ timestamp: String(e.timestamp||''), source: String(e.source||''), title: String(e.title||''), description: String(e.description||'') }));
      const csvText = [headers.join(','), ...rows.map(r=> headers.map(h=> csvEscapeSyn(r[h])).join(','))].join('\n');
      f.push({ id:'__db_support__', filename:`support_tickets_${support.length}_rows.csv`, uploadDate: new Date().toISOString(), headers, rows, csvText, totalRows: rows.length, created: rows.length, skipped:0, sizeKB: csvText.length/1024, tenantId, backendResult:{synthetic:true, source:'db_support'} } as UploadEntry);
    }
    if (feedback.length > 0) {
      const headers = ['timestamp','source','title','description'];
      const rows: Record<string,string>[] = feedback.map((e:any)=> ({ timestamp: String(e.timestamp||''), source: String(e.source||''), title: String(e.title||''), description: String(e.description||'') }));
      const csvText = [headers.join(','), ...rows.map(r=> headers.map(h=> csvEscapeSyn(r[h])).join(','))].join('\n');
      f.push({ id:'__db_feedback__', filename:`feedback_entries_${feedback.length}_rows.csv`, uploadDate: new Date().toISOString(), headers, rows, csvText, totalRows: rows.length, created: rows.length, skipped:0, sizeKB: csvText.length/1024, tenantId, backendResult:{synthetic:true, source:'db_feedback'} } as UploadEntry);
    }
    return f;
  }, [customers, usage, support, feedback, tenantId]);

  const displayedUploads = useMemo(() => {
    // User uploads first (newest first), then synthetic DB snapshots after
    return [...uploads, ...syntheticFolders];
  }, [uploads, syntheticFolders]);

  // Keep selected valid — defaults to first displayed (user upload or DB customers)
  useEffect(() => {
    if (displayedUploads.length === 0) { setSelectedId(null); return; }
    if (!selectedId || !displayedUploads.find(u => u.id === selectedId)) {
      setSelectedId(displayedUploads[0].id);
    }
  }, [displayedUploads, selectedId]);

  const selectedUpload = useMemo(() => displayedUploads.find(u => u.id === selectedId) || null, [displayedUploads, selectedId]);
  const isSynthetic = Boolean(selectedUpload?.id?.startsWith('__db_'));

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pf, cs] = await Promise.all([getPortfolio().catch(() => null), getCustomers().catch(() => [])]);
      setPortfolio(pf);
      setCustomers(cs as any[]);
      const slice = (cs as any[]).slice(0, 12);
      const tls = await Promise.all(slice.map(c => getCustomerTimeline(c.id, 30).catch(() => [])));
      const flat = tls.flat().sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimelines(flat);
      refreshUploads();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);


  const filteredCustomers = customers.filter((c: any) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.domain.toLowerCase().includes(q.toLowerCase()));

  const handleDeleteUpload = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (id.startsWith('__db_')) {
      alert('System database snapshot folders cannot be deleted — they reflect current DB state. Only your uploaded CSV folders can be deleted.');
      return;
    }
    if (!confirm('Delete this uploaded dataset folder? Complete CSV will be removed from Data Hub (customers remain).')) return;
    deleteUpload(id, tenantId);
    refreshUploads();
  };

  const handleClearAll = () => {
    if (uploads.length === 0) { alert('No uploaded CSV folders to clear — system snapshots remain.'); return; }
    if (!confirm(`Clear all ${uploads.length} uploaded CSV folder(s)? This only clears your uploads — system database snapshots stay and customers stay in DB.`)) return;
    clearUploads(tenantId);
    refreshUploads();
  };

  const handleDownloadCsv = (u: UploadEntry) => {
    const blob = new Blob([u.csvText || ''], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = u.filename || `retainai_${u.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Prepare complete CSV filtered + paginated for selected upload
  const filteredRows = useMemo(() => {
    if (!selectedUpload) return [];
    const rows = selectedUpload.rows || [];
    if (!csvSearch.trim()) return rows;
    const needle = csvSearch.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(needle)));
  }, [selectedUpload, csvSearch]);

  const pagedRows = useMemo(() => {
    const start = (csvPage - 1) * csvPageSize;
    return filteredRows.slice(start, start + csvPageSize);
  }, [filteredRows, csvPage]);

  const totalCsvPages = Math.max(1, Math.ceil(filteredRows.length / csvPageSize));

  useEffect(() => { setCsvPage(1); }, [selectedId, csvSearch]);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalCustomers = portfolio?.metrics?.total_customers ?? customers.length;

  return (
    <div className="space-y-5">
      {/* Header metrics */}
      <Card>
        <SectionHeader title="Data Hub" subtitle="Tenant-isolated — every upload becomes a folder with complete CSV. New files stack as folders." icon={Database} action={<button onClick={load} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Refresh</button>} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">CUSTOMERS</div>
            <div className="text-xl font-bold mt-1">{customers.length}</div>
            <div className="text-[11px] text-slate-500">{totalCustomers} total</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">USAGE</div>
            <div className="text-xl font-bold mt-1">{usage.length}</div>
            <div className="text-[11px] text-slate-500">events</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">SUPPORT</div>
            <div className="text-xl font-bold mt-1">{support.length}</div>
            <div className="text-[11px] text-slate-500">tickets</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">FEEDBACK</div>
            <div className="text-xl font-bold mt-1">{feedback.length}</div>
            <div className="text-[11px] text-slate-500">entries</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-amber-700 flex items-center justify-center gap-1"><Folder className="w-3 h-3" /> FILES</div>
            <div className="text-xl font-bold mt-1 text-amber-900">{displayedUploads.length}</div>
            <div className="text-[11px] text-amber-700">{uploads.length} upload{uploads.length!==1?'s':''} + {syntheticFolders.length} db</div>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-3 flex flex-wrap gap-2">Uploads appear instantly: <b>CSV/JSON → Customers</b> · <b>Usage/Support/Feedback → respective tabs</b> · <b>Files → folder explorer with complete CSV</b> · Each new CSV = new folder.</div>
      </Card>

      {/* ── NEW: Folder Structure Explorer ── */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold flex items-center gap-2">Uploaded Datasets — Folder Structure
                <span className="text-[11px] font-mono bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">{displayedUploads.length} folder{displayedUploads.length !== 1 ? 's' : ''}</span>
                {syntheticFolders.length>0 && <span className="text-[11px] font-mono bg-slate-900 text-white px-2 py-0.5 rounded-full">{syntheticFolders.length} live DB</span>}
              </div>
              <div className="text-xs text-slate-500 truncate">Already-present DB appears as folders + every new CSV stacks as new folder. Click folder → complete CSV right side.</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowUploadInline(v => !v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${showUploadInline ? 'bg-slate-900 text-white border-slate-900' : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'}`}>
              {showUploadInline ? <X className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />} {showUploadInline ? 'Close' : 'Upload CSV'}
            </button>
            {displayedUploads.length > 0 && <button onClick={handleClearAll} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50"><Trash2 className="w-3.5 h-3.5" /> Clear uploads</button>}
            <button onClick={() => setFolderCollapsed(v => !v)} className="hidden sm:inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50">
              {folderCollapsed ? <Folder className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />} {folderCollapsed ? 'Show tree' : 'Hide tree'}
            </button>
          </div>
        </div>

        {showUploadInline && (
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload new CSV → it appears as a new folder below</div>
            <CsvUpload onSuccess={() => { refreshUploads(); load(); setShowUploadInline(false); }} onClose={() => setShowUploadInline(false)} />
          </div>
        )}

        <div className="flex min-h-[420px] max-h-[720px]">
          {/* Left — Folder Tree */}
          {!folderCollapsed && (
            <div className="w-full sm:w-[300px] shrink-0 border-r border-slate-200 bg-[#FAFAF9] flex flex-col">
              <div className="p-3 border-b border-slate-200 bg-white/60 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-500 tracking-wide flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> TENANT FILES</div>
                  <span className="text-[11px] font-mono border border-slate-200 bg-white px-2 py-0.5 rounded-full">{tenantId.slice(0, 8)}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 font-mono">{displayedUploads.length === 0 ? 'No data yet' : `${uploads.length} upload(s) + ${syntheticFolders.length} live DB · ${displayedUploads.length} total`}</div>
              </div>

              <div className="flex-1 overflow-auto p-2 space-y-1">
                {/* Root */}
                <div className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 text-xs font-medium shadow-sm">
                  <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">/ uploads</span>
                  <span className="ml-auto text-[11px] font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">{displayedUploads.length}</span>
                </div>
                <div className="ml-3 pl-3 border-l border-dashed border-slate-200 space-y-1">
                  {displayedUploads.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto"><Folder className="w-5 h-5 text-slate-300" /></div>
                      <div className="text-xs font-medium text-slate-600 mt-2">No folders yet</div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-relaxed px-2">Seed or upload a CSV. Already-present customers, usage, support, feedback appear as live DB folders automatically.</div>
                      <button onClick={() => setShowUploadInline(true)} className="mt-3 inline-flex items-center gap-1.5 bg-[#0F172A] text-white px-3 py-1.5 rounded-lg text-xs">Upload now →</button>
                    </div>
                  ) : (
                    <>
                    {/* User uploads section */}
                    {uploads.length>0 && <div className="text-[10px] font-mono tracking-widest text-slate-400 px-1 pt-1">YOUR UPLOADS</div>}
                    {uploads.map((u) => {
                      const active = selectedId === u.id;
                      const dt = new Date(u.uploadDate);
                      const dateLabel = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <button
                          key={u.id}
                          onClick={() => setSelectedId(u.id)}
                          className={`w-full text-left group flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg border transition ${active ? 'bg-[#0F172A] text-white border-slate-900 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                        >
                          <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-white/15' : 'bg-amber-50 border border-amber-200'}`}>
                            <FileSpreadsheet className={`w-4 h-4 ${active ? 'text-white' : 'text-amber-600'}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-xs font-semibold truncate ${active ? 'text-white' : 'text-slate-800'}`} title={u.filename}>{u.filename}</div>
                            <div className={`text-[11px] font-mono truncate ${active ? 'text-white/60' : 'text-slate-500'}`}>{u.headers.slice(0, 3).join(', ')}{u.headers.length > 3 ? ` +${u.headers.length - 3}` : ''} · {u.totalRows} rows</div>
                            <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${active ? 'text-white/50' : 'text-slate-400'}`}><Clock className="w-3 h-3" /> {dateLabel} · {(u.sizeKB).toFixed(1)}KB</div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${active ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{u.created} created</span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${active ? 'bg-white/10 text-white/70 border-white/20' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>CSV</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            {active ? <ChevronDown className="w-3.5 h-3.5 text-white/60" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />}
                            <span onClick={(e) => handleDeleteUpload(u.id, e as any)} className={`p-1 rounded-md hover:bg-red-50 ${active ? 'hover:bg-white/15' : ''}`} title="Delete folder">
                              <Trash2 className={`w-3.5 h-3.5 ${active ? 'text-white/60 hover:text-red-300' : 'text-slate-400 hover:text-red-600'}`} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {/* Synthetic live DB section */}
                    {syntheticFolders.length>0 && <div className="text-[10px] font-mono tracking-widest text-slate-400 px-1 pt-2 flex items-center gap-1"><Database className="w-3 h-3" /> LIVE DATABASE · ALREADY PRESENT</div>}
                    {syntheticFolders.map((u) => {
                      const active = selectedId === u.id;
                      const isCust = u.id==='__db_customers__';
                      const bg = isCust ? 'bg-emerald-50 border-emerald-200' : u.id==='__db_usage__' ? 'bg-blue-50 border-blue-200' : u.id==='__db_support__' ? 'bg-orange-50 border-orange-200' : 'bg-purple-50 border-purple-200';
                      const ic = isCust ? 'text-emerald-600' : u.id==='__db_usage__' ? 'text-blue-600' : u.id==='__db_support__' ? 'text-orange-600' : 'text-purple-600';
                      return (
                        <button
                          key={u.id}
                          onClick={() => setSelectedId(u.id)}
                          className={`w-full text-left group flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg border transition ${active ? 'bg-[#0F172A] text-white border-slate-900 shadow-md' : `bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50`}`}
                        >
                          <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${active ? 'bg-white/15 border-white/20' : bg}`}>
                            {isCust ? <Users className={`w-4 h-4 ${active?'text-white':ic}`} /> : u.id==='__db_usage__' ? <Activity className={`w-4 h-4 ${active?'text-white':ic}`} /> : u.id==='__db_support__' ? <LifeBuoy className={`w-4 h-4 ${active?'text-white':ic}`} /> : <MessageSquare className={`w-4 h-4 ${active?'text-white':ic}`} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-xs font-semibold truncate flex items-center gap-1 ${active ? 'text-white' : 'text-slate-800'}`} title={u.filename}>{u.filename} <span className={`text-[10px] px-1 py-0 rounded font-mono ${active?'bg-white/20 text-white':'bg-slate-900 text-white'}`}>DB</span></div>
                            <div className={`text-[11px] font-mono truncate ${active ? 'text-white/60' : 'text-slate-500'}`}>{u.headers.slice(0, 3).join(', ')}{u.headers.length > 3 ? ` +${u.headers.length - 3}` : ''} · {u.totalRows} rows</div>
                            <div className={`text-[11px] mt-0.5 ${active ? 'text-white/50' : 'text-slate-400'}`}>Live snapshot · {(u.sizeKB).toFixed(1)}KB · complete CSV</div>
                          </div>
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            {active ? <ChevronDown className="w-3.5 h-3.5 text-white/60" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />}
                            <span className={`text-[10px] font-mono ${active?'text-white/40':'text-slate-300'}`}>•</span>
                          </div>
                        </button>
                      );
                    })}
                    </>
                  )}
                </div>

                <div className="mt-3 p-2.5 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-mono text-slate-500">How folders work</div>
                  <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">• <b>Already-present</b> DB appears as live folders (DB badge) — complete CSV snap right side.<br />• Each <b>new upload</b> stacks as new folder on top (CSV badge).<br />• Tenants isolated · DB folders refresh on load.</div>
                </div>
              </div>

              <div className="p-2 border-t border-slate-200 bg-white">
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> {displayedUploads.reduce((a, u) => a + u.totalRows, 0)} total rows across {displayedUploads.length} folders ({uploads.length} uploads + {syntheticFolders.length} db)</div>
              </div>
            </div>
          )}

          {/* Right — Complete CSV */}
          <div className="flex-1 min-w-0 flex flex-col bg-white">
            {!selectedUpload ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto"><Folder className="w-8 h-8 text-slate-300" /></div>
                  <div className="text-sm font-semibold mt-3">Select a folder to view complete CSV</div>
                  <div className="text-xs text-slate-500 mt-1">Already-present DB folders + your uploads appear left as folders. Click any → full CSV (all rows, all columns) loads here.</div>
                  {displayedUploads.length === 0 && <button onClick={() => setShowUploadInline(true)} className="mt-4 inline-flex items-center gap-1.5 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-xs font-semibold"><Upload className="w-3.5 h-3.5" /> Upload first CSV</button>}
                </div>
              </div>
            ) : (
              <>
                {/* File header */}
                <div className="p-4 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${isSynthetic ? 'bg-slate-900 border-slate-900' : 'bg-amber-50 border-amber-200'}`}>{isSynthetic ? <Database className="w-5 h-5 text-white" /> : <FileSpreadsheet className="w-5 h-5 text-amber-600" />}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate flex items-center gap-2" title={selectedUpload.filename}>{selectedUpload.filename} {isSynthetic ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono">LIVE DB</span> : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-mono">UPLOAD</span>}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 truncate">Folder /uploads/{selectedUpload.filename} · {isSynthetic ? 'live snapshot' : new Date(selectedUpload.uploadDate).toLocaleString()} · {selectedUpload.headers.length} cols · {selectedUpload.totalRows} rows · {(selectedUpload.sizeKB).toFixed(1)}KB {isSynthetic && '· already present shows here'}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="text-[11px] font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">headers: {selectedUpload.headers.join(', ').slice(0, 80)}{selectedUpload.headers.join(', ').length > 80 ? '…' : ''}</span>
                          <span className="text-[11px] font-mono bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">{selectedUpload.created} rows</span>
                          <span className="text-[11px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-full">{selectedUpload.totalRows} total_rows · complete CSV</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleDownloadCsv(selectedUpload)} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50"><Download className="w-3.5 h-3.5" /> Download CSV</button>
                      {onSelectCustomer && <button onClick={() => { const el = document.querySelector('[data-customers-anchor]'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="hidden sm:inline-flex items-center gap-1.5 bg-[#0F172A] text-white px-3 py-1.5 rounded-lg text-xs"><Eye className="w-3.5 h-3.5" /> Customers</button>}
                      {!isSynthetic ? <button onClick={(e) => handleDeleteUpload(selectedUpload.id, e)} className="p-1.5 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200" title="Delete folder"><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" /></button> : <span className="text-[11px] font-mono bg-slate-50 border border-slate-200 px-2 py-1 rounded-full text-slate-500">DB — protected</span>}
                    </div>
                  </div>

                  {/* CSV search + meta */}
                  <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                    <div className="relative flex-1 sm:max-w-[360px]">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={csvSearch} onChange={e => setCsvSearch(e.target.value)} placeholder="Search complete CSV — any column..." className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-slate-400" />
                      {csvSearch && <button onClick={() => setCsvSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono border border-slate-200 bg-slate-50 px-2 py-1 rounded-full">{filteredRows.length} / {selectedUpload.totalRows} rows {csvSearch ? '· filtered' : ''}</span>
                      <span className="hidden sm:inline text-slate-400">·</span>
                      <span className="hidden sm:inline text-slate-500">{selectedUpload.headers.length} columns · complete CSV</span>
                    </div>
                  </div>
                </div>

                {/* Complete CSV Table */}
                <div className="flex-1 overflow-auto">
                  <div className="overflow-auto max-h-[420px]">
                    <table className="w-full text-xs min-w-[640px]">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-mono text-slate-500">
                        <tr>
                          <th className="text-left p-2.5 font-medium whitespace-nowrap sticky left-0 bg-slate-50 border-r border-slate-200 w-10">#</th>
                          {selectedUpload.headers.map(h => (
                            <th key={h} className="text-left p-2.5 font-medium whitespace-nowrap" title={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedRows.length === 0 ? (
                          <tr><td colSpan={selectedUpload.headers.length + 1} className="p-8 text-center text-sm text-slate-500">{csvSearch ? `No rows match "${csvSearch}"` : 'No rows in this CSV'}</td></tr>
                        ) : (
                          pagedRows.map((r, i) => {
                            const globalIdx = (csvPage - 1) * csvPageSize + i + 1;
                            return (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2.5 font-mono text-slate-400 sticky left-0 bg-white border-r border-slate-100">{globalIdx}</td>
                                {selectedUpload.headers.map(h => (
                                  <td key={h} className="p-2.5 truncate max-w-[200px]" title={String(r[h] ?? '')}>{r[h] ? String(r[h]) : <span className="text-slate-300">—</span>}</td>
                                ))}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination & footer */}
                <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="text-xs text-slate-500 font-mono">
                    {csvSearch ? `Filtered ${filteredRows.length} of ${selectedUpload.totalRows}` : `Complete CSV — ${selectedUpload.totalRows} rows`} · Page {csvPage}/{totalCsvPages} · {pagedRows.length} shown
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button disabled={csvPage <= 1} onClick={() => setCsvPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40 hover:bg-slate-50">Prev</button>
                    <span className="text-xs font-mono px-2">{csvPage} / {totalCsvPages}</span>
                    <button disabled={csvPage >= totalCsvPages} onClick={() => setCsvPage(p => Math.min(totalCsvPages, p + 1))} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40 hover:bg-slate-50">Next</button>
                    {folderCollapsed && <button onClick={() => setFolderCollapsed(false)} className="ml-2 inline-flex items-center gap-1 border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded-lg text-xs"><FolderOpen className="w-3.5 h-3.5" /> Tree</button>}
                  </div>
                </div>

                <div className="px-4 pb-3">
                  <div className={`rounded-xl p-3 flex items-start gap-3 ${isSynthetic ? 'bg-emerald-950 border border-emerald-800' : 'bg-slate-900 border border-slate-800'}`}>
                    <HardDrive className={`w-4 h-4 mt-0.5 shrink-0 ${isSynthetic ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <div className="text-xs leading-relaxed">
                      <div className="font-semibold text-white">{isSynthetic ? 'Live database snapshot — already present' : 'Folder guarantee — your upload'}</div>
                      <div className={isSynthetic ? 'text-emerald-200/80 mt-0.5' : 'text-slate-400 mt-0.5'}>{isSynthetic ? <>This <b className="text-white">DB folder</b> is built from <b className="text-white">already-present</b> records in this tenant (customers/usage/support/feedback). It proves existing data shows here — not 0. It updates on refresh. Complete CSV with all rows.</> : <>This folder preserves the <b className="text-slate-200">complete CSV</b> as uploaded — all columns, all rows. New uploads create new folders (folder structure). Data is tenant-isolated (<span className="font-mono text-slate-200">{tenantId}</span>) and survives page refresh. Delete only removes the explorer entry — imported customers remain safe.</>}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs card — existing but updated hint */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit overflow-auto">
            {([
              { id: 'all', label: 'All', icon: Clock, count: timelines.length },
              { id: 'customers', label: 'Customers', icon: Users, count: customers.length },
              { id: 'usage', label: 'Usage', icon: Activity, count: usage.length },
              { id: 'support', label: 'Support', icon: LifeBuoy, count: support.length },
              { id: 'feedback', label: 'Feedback', icon: MessageSquare, count: feedback.length },
            ] as const).map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${active ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
                  <Icon className="w-3.5 h-3.5" /> {t.label} <span className={`px-1.5 py-0.5 rounded-full font-mono text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-white border border-slate-200'}`}>{t.count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 sm:max-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'customers' ? 'Search customers...' : 'Search events...'} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-slate-400" />
          </div>
        </div>

        <div className="mt-4">
          {tab === 'customers' ? (
            filteredCustomers.length === 0 ? (
              <EmptyState title="No customers yet" description="Upload CSV/JSON or add manually — they appear here and in Command Center + Analytics." />
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden" data-customers-anchor>
                <div className="max-h-[480px] overflow-auto divide-y divide-slate-100">
                  {filteredCustomers.slice(0, 50).map((c: any) => (
                    <div key={c.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{c.domain} · {c.segment} · {c.risk_level} · {Math.round(c.health_score)}/100</div>
                      </div>
                      {onSelectCustomer && <button onClick={() => onSelectCustomer(c.id)} className="text-xs border border-slate-200 bg-white px-2.5 py-1 rounded-lg hover:bg-slate-50 shrink-0">360 →</button>}
                    </div>
                  ))}
                </div>
                {filteredCustomers.length > 50 && <div className="p-2 text-xs text-slate-500 text-center border-t border-slate-100">{filteredCustomers.length - 50} more — use Customers page filters</div>}
              </div>
            )
          ) : tab === 'all' && timelines.length === 0 ? (
            <EmptyState title="No timeline yet" description="Upload customers + telemetry — unified timeline appears here and in 360." />
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {(tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).filter((e: any) => !q || (e.title || '').toLowerCase().includes(q.toLowerCase())).slice(0, 60).map((e: any) => (
                <div key={e.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-500">{new Date(e.timestamp).toLocaleString()}</span>
                    <span className="text-[11px] border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full font-mono uppercase">{e.source}</span>
                  </div>
                  <div className="text-sm font-medium mt-1">{e.title}</div>
                  {e.description && <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{e.description}</div>}
                </div>
              ))}
              {(tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).length === 0 && <div className="text-xs text-slate-500 text-center py-6">No {tab} events — inject via 360 or bulk API.</div>}
            </div>
          )}
          {tab !== 'customers' && timelines.length > 0 && <div className="text-xs text-slate-500 mt-2">Showing {Math.min(60, (tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).length)} of {(tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).length} — common All + separate per-type.</div>}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Where uploads go</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="border border-slate-200 rounded-lg p-3"><div className="font-semibold flex items-center gap-1.5"><Folder className="w-3.5 h-3.5 text-amber-600" /> CSV / JSON / Single form</div><div className="text-slate-600 mt-1">→ <b>Customers</b> + <b>Data Hub → Customers</b> + <b>Command Center</b> KPI + <b>new folder in explorer</b> with complete CSV</div></div>
          <div className="border border-slate-200 rounded-lg p-3"><div className="font-semibold">Usage / Support / Feedback</div><div className="text-slate-600 mt-1">→ <b>Data Hub → Usage/Support/Feedback</b> + <b>360 Timeline</b> + <b>All</b></div></div>
          <div className="border border-slate-200 rounded-lg p-3"><div className="font-semibold">Common All + Files</div><div className="text-slate-600 mt-1">Unified timeline = 360 but tenant-wide. <b>Files</b> folder = full CSVs, stacked per upload.</div></div>
        </div>
      </Card>
    </div>
  );
};
