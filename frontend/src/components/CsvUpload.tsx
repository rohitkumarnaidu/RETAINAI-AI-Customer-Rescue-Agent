import React, { useState, useRef, useMemo } from 'react';
import { uploadCustomersCsv, createCustomer, getCustomerCsvTemplate } from '../services/api';
import { Card, SectionHeader } from './ui';
import { Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Plus, Loader2, UserPlus } from 'lucide-react';

export const CsvUpload: React.FC<{ onSuccess?: () => void; onClose?: () => void }> = ({ onSuccess, onClose }) => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string,string>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Add single customer form
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', domain: '', segment: 'MidMarket', industry: 'Software', plan: 'Growth Tier', arr: '36000', csm_name: 'Alex Morgan', csm_email: 'alex@retainai.io', health_score: '', risk_level: '', renewal_date: '' });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f); setResult(null); setError(null);
    // Client preview: read first 6 rows
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return;
        const headers = lines[0].split(',').map(h => h.trim());
        setPreviewHeaders(headers);
        const rows = lines.slice(1, 7).map(line => {
          const cols = line.split(',');
          const obj: Record<string,string> = {};
          headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
          return obj;
        });
        setPreviewRows(rows);
      } catch { /* ignore */ }
    };
    reader.readAsText(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    try {
      const res = await uploadCustomersCsv(file);
      setResult(res);
      if (res.created > 0 && onSuccess) onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || e.message || 'Upload failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally { setUploading(false); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const tpl = await getCustomerCsvTemplate();
      const blob = new Blob([tpl.csv_text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = tpl.filename || 'retainai_customers_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback client-side
      const headers = 'name,domain,segment,industry,plan,arr,mrr,csm_name,csm_email,health_score,risk_level,renewal_date,status';
      const sample = 'Example Corp,example.com,Enterprise,FinTech,Enterprise Tier,180000,15000,Alex Morgan,alex@retainai.io,42,CRITICAL,2026-09-15,ACTIVE';
      const blob = new Blob([headers + '\n' + sample + '\n'], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'retainai_customers_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true); setFormError(null); setFormSuccess(null);
    try {
      const payload: any = {
        name: formData.name,
        domain: formData.domain || undefined,
        segment: formData.segment,
        industry: formData.industry,
        plan: formData.plan,
        arr: formData.arr ? Number(formData.arr) : undefined,
        csm_name: formData.csm_name,
        csm_email: formData.csm_email,
        health_score: formData.health_score ? Number(formData.health_score) : undefined,
        risk_level: formData.risk_level || undefined,
        renewal_date: formData.renewal_date || undefined,
      };
      const created = await createCustomer(payload);
      setFormSuccess(`Created ${created.name} (${created.id}) — health ${created.health_score} · ${created.risk_level}`);
      setFormData(d => ({ ...d, name: '', domain: '' }));
      if (onSuccess) onSuccess();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail || e.message || 'Create failed');
    } finally { setFormSaving(false); }
  };

  const todayPlus90 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Download template CSV
          </button>
          <span className="text-xs text-slate-400 hidden sm:inline">Columns: name* , domain, segment, industry, plan, arr, csm_name, csm_email, health_score, risk_level, renewal_date, status</span>
        </div>
        <button onClick={() => setShowAddForm(v => !v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${showAddForm ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />} {showAddForm ? 'Close form' : 'Add single customer'}
        </button>
      </div>

      {/* Add single form */}
      {showAddForm && (
        <Card>
          <SectionHeader title="Add single customer" subtitle="Creates instantly via POST /customers — appears in portfolio + searchable" icon={Plus} />
          <form onSubmit={handleCreateSingle} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Customer name *</label>
                <input required value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="Example Corp" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Domain</label>
                <input value={formData.domain} onChange={e => setFormData(d => ({ ...d, domain: e.target.value }))} placeholder="example.com (auto from name if empty)" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Segment</label>
                <select value={formData.segment} onChange={e => setFormData(d => ({ ...d, segment: e.target.value }))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option>Enterprise</option><option>MidMarket</option><option>SMB</option><option>Startup</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Industry</label>
                <input value={formData.industry} onChange={e => setFormData(d => ({ ...d, industry: e.target.value }))} placeholder="Software / FinTech / Healthcare" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Plan</label>
                <input value={formData.plan} onChange={e => setFormData(d => ({ ...d, plan: e.target.value }))} placeholder="Growth Tier / Enterprise Tier" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">ARR ($)</label>
                <input type="number" value={formData.arr} onChange={e => setFormData(d => ({ ...d, arr: e.target.value }))} placeholder="36000" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">CSM name</label>
                <input value={formData.csm_name} onChange={e => setFormData(d => ({ ...d, csm_name: e.target.value }))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">CSM email</label>
                <input type="email" value={formData.csm_email} onChange={e => setFormData(d => ({ ...d, csm_email: e.target.value }))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Health score 0-100</label>
                <input type="number" min={0} max={100} value={formData.health_score} onChange={e => setFormData(d => ({ ...d, health_score: e.target.value }))} placeholder="— auto from risk if blank" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Risk level (auto if empty)</label>
                <select value={formData.risk_level} onChange={e => setFormData(d => ({ ...d, risk_level: e.target.value }))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Auto from health</option><option>HEALTHY</option><option>STABLE</option><option>WATCH</option><option>AT_RISK</option><option>HIGH_RISK</option><option>CRITICAL</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-700">Renewal date</label>
                <input type="date" value={formData.renewal_date} onChange={e => setFormData(d => ({ ...d, renewal_date: e.target.value }))} placeholder={todayPlus90} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{formError}</div>}
            {formSuccess && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{formSuccess}</div>}
            <button type="submit" disabled={formSaving || !formData.name.trim()} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create customer
            </button>
          </form>
        </Card>
      )}

      {/* Drag drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition ${dragOver ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'} ${file ? 'bg-slate-50' : ''}`}
      >
        <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div className="mt-3 text-sm font-semibold">Drop CSV here or click to browse</div>
        <div className="text-xs text-slate-500 mt-1">Max 500 rows · 2MB · UTF-8 · Header must include <code className="bg-slate-100 px-1 py-0.5 rounded">name</code></div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50">
            <Upload className="w-3.5 h-3.5" /> Browse file
          </button>
          {file && <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-1 rounded-full">{file.name} · {(file.size / 1024).toFixed(1)}KB</span>}
          {file && <button onClick={() => { setFile(null); setPreviewRows([]); setPreviewHeaders([]); setResult(null); setError(null); }} className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"><X className="w-4 h-4" /></button>}
        </div>
        {file && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={handleUpload} disabled={uploading} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {uploading ? 'Uploading…' : `Upload ${file.name}`}
            </button>
            {onClose && <button onClick={onClose} className="border border-slate-200 bg-white px-3 py-2 rounded-lg text-xs">Cancel</button>}
          </div>
        )}
      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <Card padding="p-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Preview — first {previewRows.length} rows</div>
              <div className="text-xs text-slate-500">Check columns before upload. Full file has header: {previewHeaders.join(', ')}</div>
            </div>
            <span className="text-xs font-mono border border-slate-200 bg-slate-50 px-2 py-1 rounded-full">{previewRows.length} preview rows</span>
          </div>
          <div className="overflow-auto max-h-52">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-mono text-slate-500">
                <tr>{previewHeaders.map(h => <th key={h} className="text-left p-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {previewHeaders.map(h => <td key={h} className="p-2 truncate max-w-[150px]">{r[h] || <span className="text-slate-300">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Result */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-800">Upload failed</div>
            <div className="text-xs text-red-700 mt-1 whitespace-pre-wrap">{error}</div>
          </div>
        </div>
      )}
      {result && (
        <div className={`border rounded-xl p-4 ${result.created > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            {result.created > 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
            <span className="text-sm font-semibold">{result.message}</span>
            <span className="text-xs font-mono border bg-white px-2 py-0.5 rounded-full">{result.created} created · {result.skipped} skipped · {result.total_rows} total</span>
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-semibold">Rows skipped / errors (first {result.errors.length})</div>
              <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                {result.errors.map((er: any, i: number) => (
                  <div key={i} className="text-xs font-mono text-slate-600">Row {er.row}: {er.error} {er.name ? `— ${er.name}` : ''}</div>
                ))}
              </div>
            </div>
          )}
          {result.created > 0 && <div className="text-xs text-slate-600 mt-2">Customers now visible in <b>Customers</b> and <b>Command Center</b>. Search by name/domain to find them. Run investigation in 360.</div>}
        </div>
      )}

      {/* Help */}
      <div className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs leading-relaxed">
        <div className="font-semibold text-white text-xs">How CSV maps to RETAINAI</div>
        <div className="mt-1 font-mono text-[11px]">name* required — domain auto from name if blank — arr/mrr numeric — health_score 0-100 auto-sets risk_level — renewal_date YYYY-MM-DD defaults +90d — segment/industry/plan/csm_* optional</div>
        <div className="mt-2 text-slate-400">Example: <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">Example Corp,example.com,Enterprise,FinTech,Enterprise Tier,180000,,Alex Morgan,alex@retainai.io,42,CRITICAL,2026-09-15,ACTIVE</code></div>
      </div>
    </div>
  );
};