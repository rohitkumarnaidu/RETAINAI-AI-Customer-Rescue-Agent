import React, { useState, useRef, useMemo } from 'react';
import { uploadCustomersCsv, createCustomer, getCustomerCsvTemplate, uploadGenericDataset } from '../services/api';
import { saveUpload } from '../services/uploadHistory';
import { Card, SectionHeader } from './ui';
import { Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Plus, Loader2, UserPlus, RefreshCw } from 'lucide-react';

const RETAIN_FIELDS = ['name','domain','segment','industry','plan','arr','mrr','csm_name','csm_email','health_score','risk_level','renewal_date','status'] as const;
type RetainField = typeof RETAIN_FIELDS[number];

const FIELD_META: Record<RetainField,{label:string;required?:boolean;hint?:string}> = {
  name:{label:'name *',required:true,hint:'required'},
  domain:{label:'domain',hint:'auto slug if blank'},
  segment:{label:'segment'},
  industry:{label:'industry'},
  plan:{label:'plan'},
  arr:{label:'arr',hint:'numeric'},
  mrr:{label:'mrr',hint:'numeric'},
  csm_name:{label:'csm_name'},
  csm_email:{label:'csm_email'},
  health_score:{label:'health_score',hint:'0-100'},
  risk_level:{label:'risk_level',hint:'auto if blank'},
  renewal_date:{label:'renewal_date',hint:'YYYY-MM-DD'},
  status:{label:'status'},
};

const ALIAS_MAP: Record<RetainField,string[]> = {
  name:['name','company','customer','account','customer_name','client','org','organization'],
  domain:['domain','website','url','site','company_domain'],
  segment:['segment','tier','size','customer_segment'],
  industry:['industry','vertical','sector'],
  plan:['plan','tier','package'],
  arr:['arr','revenue','annual_revenue','annualrevenue','annual_arr'],
  mrr:['mrr','monthly_revenue','monthlyrevenue'],
  csm_name:['csm_name','csm','owner','account_manager','csmname','manager'],
  csm_email:['csm_email','csm email','email','owner_email'],
  health_score:['health_score','health','score','healthscore'],
  risk_level:['risk_level','risk','risklevel'],
  renewal_date:['renewal_date','renewal','renew','renewaldate'],
  status:['status','state'],
};

function autoMap(headers: string[]): Record<RetainField,string> {
  const lowerHeaders = headers.map(h=>h.trim());
  const lowerMap = new Map<string,string>();
  lowerHeaders.forEach(h=> lowerMap.set(h.toLowerCase(), h));
  const out: Record<RetainField,string> = {} as Record<RetainField,string>;
  (RETAIN_FIELDS as readonly string[]).forEach(field=>{
    const aliases = ALIAS_MAP[field as RetainField] || [field];
    let found = '';
    for (const a of aliases){
      if (lowerMap.has(a)) { found = lowerMap.get(a)!; break; }
      // also check aliases with underscore variant
      const underscored = a.replace(/\s+/g,'_');
      if (lowerMap.has(underscored)) { found = lowerMap.get(underscored)!; break; }
    }
    // fallback exact field lower
    if (!found && lowerMap.has(field.toLowerCase())) found = lowerMap.get(field.toLowerCase())!;
    // also check case-insensitive header equals field without underscore
    if (!found){
      const normField = field.replace('_','').toLowerCase();
      for (const h of headers){
        if (h.toLowerCase().replace(/[\s_]+/g,'')===normField){ found=h; break; }
      }
    }
    out[field as RetainField]=found;
  });
  return out;
}

function csvEscape(v:string):string {
  if (v==null) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

export const CsvUpload: React.FC<{ onSuccess?: () => void; onClose?: () => void }> = ({ onSuccess, onClose }) => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string,string>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [fullRows, setFullRows] = useState<Record<string,string>[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<RetainField,string>>(()=> ({} as Record<RetainField,string>));
  const [showMapping, setShowMapping] = useState(false);
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

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"'){
        if(inQuotes && line[i+1]==='"'){ cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if(ch===',' && !inQuotes){
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out.map(v=> v.replace(/^"(.*)"$/s,'$1').trim());
  };

  const handleFile = (f: File) => {
    setFile(f); setResult(null); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        setRawText(text);
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return;
        const headers = parseCsvLine(lines[0]);
        setPreviewHeaders(headers);
        const allRows = lines.slice(1).map(line => {
          const cols = parseCsvLine(line);
          const obj: Record<string,string> = {};
          headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
          return obj;
        }).filter(r=> Object.values(r).some(v=>v));
        setFullRows(allRows);
        setPreviewRows(allRows.slice(0,7));
        const mapped = autoMap(headers);
        setColumnMapping(mapped);
        // auto-show mapping if not exact name match
        const hasWeirdHeaders = headers.some(h=> !RETAIN_FIELDS.includes(h.toLowerCase() as RetainField)) || !headers.map(h=>h.toLowerCase()).includes('name');
        if (hasWeirdHeaders) setShowMapping(true);
        else setShowMapping(false);
      } catch { /* ignore */ }
    };
    reader.readAsText(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const buildRemappedFile = (): File | null => {
    if (!file || !rawText) return null;
    // Determine if mapping is identity (source header lower == retain field lower)
    const mappedFields = (RETAIN_FIELDS as readonly string[]).filter(f=> (columnMapping[f as RetainField]||'').trim() !== '') as RetainField[];
    if (mappedFields.length===0) return null;
    if (!mappedFields.includes('name')) return null;
    // Check if any mapping differs from exact lower match
    let needsRemap = false;
    for (const f of mappedFields){
      const src = columnMapping[f];
      if (src.toLowerCase() !== f.toLowerCase()) needsRemap = true;
    }
    // Also if not all headers are mappedFields (i.e., user skipped some columns, we still want to remap to only those fields)
    // So always remap when showMapping is true, to be explicit
    if (!showMapping && !needsRemap) return null;

    // Build new header line as retain field names that are mapped + any unmapped original headers preserved as extra columns
    // This ensures arbitrary dataset fields (e.g., churn_score, extra_field) are sent to backend and stored as metadata_json
    const canonicalMappedSet = new Set(mappedFields.map(f=> columnMapping[f]));
    const extraHeaders = previewHeaders.filter(h => !canonicalMappedSet.has(h));
    const newHeaders = [...mappedFields, ...extraHeaders];
    const lines: string[] = [];
    lines.push(newHeaders.map(h=>csvEscape(h)).join(','));
    for (const row of fullRows){
      const vals = newHeaders.map(h=>{
        if ((mappedFields as string[]).includes(h)) {
          const src = columnMapping[h as RetainField];
          return csvEscape(row[src] ?? '');
        } else {
          // extra column - use original header value directly
          return csvEscape(row[h] ?? '');
        }
      });
      lines.push(vals.join(','));
    }
    const newText = lines.join('\n') + '\n';
    return new File([newText], file.name, {type:'text/csv'});
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    try {
      // Validate name mapped
      if (showMapping){
        const nameSrc = columnMapping['name'];
        if (!nameSrc){
          setError("Column Mapping: 'name' must be mapped — choose which CSV column contains the customer name (e.g., 'company' → name)");
          setUploading(false);
          return;
        }
      }
      const remapped = showMapping ? buildRemappedFile() : null;
      const fileToUpload = remapped || file;
      // Detect generic: if headers don't contain retain 'name' and not telemetry, upload as any dataset
      const lowerHeaders = (remapped ? (await remapped.text()).split('\n')[0] : previewHeaders.join(',')).toLowerCase();
      const isGeneric = !previewHeaders.map(h=>h.toLowerCase()).includes('name') && !['timestamp','severity','sentiment','event_type'].some(k=> lowerHeaders.includes(k)) && previewHeaders.length>0;
      let res:any;
      if(isGeneric && !showMapping){
        // Any CSV with arbitrary headers → generic dataset
        const dsName = file.name.replace(/\.csv$/i,'').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,40) || 'custom_dataset';
        res = await uploadGenericDataset(fileToUpload, dsName);
        // map generic response to customers-like shape for toast
        res = { created: (res as any).rows || 0, skipped: 0, total_rows: fullRows.length, message: `Generic dataset ${(res as any).dataset_name} — ${(res as any).rows} rows` } as any;
      } else {
        res = await uploadCustomersCsv(fileToUpload);
      }
      setResult(res);
      // — Persist complete CSV to Data Hub folder structure (tenant-isolated) —
      try {
        const tenantId = (()=>{ try{ return localStorage.getItem('retainai_tenant_id')||localStorage.getItem('retainai_tenantId')||'demo-tenant-001'}catch{return 'demo-tenant-001'}})();
        // Determine effective headers/rows that were uploaded
        let effectiveHeaders = previewHeaders;
        let effectiveRows = fullRows;
        let csvTextEffective = rawText;
        if (remapped) {
          // read remapped file text for storage (already built)
          try {
            csvTextEffective = await remapped.text();
            const lines = csvTextEffective.split(/\r?\n/).filter(l=>l.trim());
            if (lines.length>0) {
              effectiveHeaders = lines[0].split(',').map(h=> h.replace(/^"|"$/g,'').trim());
              effectiveRows = fullRows.map(r=>{
                const obj: Record<string,string>={};
                effectiveHeaders.forEach(h=>{
                  const src = columnMapping[h as RetainField];
                  obj[h]= r[src] ?? '';
                });
                return obj;
              });
            }
          } catch {}
        }
        saveUpload({
          filename: file.name,
          headers: effectiveHeaders,
          rows: effectiveRows,
          csvText: csvTextEffective || rawText,
          totalRows: fullRows.length,
          created: (res as any).created ?? 0,
          skipped: (res as any).skipped ?? 0,
          sizeKB: file.size/1024,
          remappedHeaders: showMapping ? (effectiveHeaders) : undefined,
          backendResult: res,
          tenantId,
        });
      } catch (e) { console.warn('persist upload history failed', e); }
      if ((res as unknown as {created:number}).created > 0 && onSuccess) onSuccess();
    } catch (e: unknown) {
      const err = e as {response?:{data?:{detail?:unknown;message?:unknown}};message?:string};
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err.message || 'Upload failed';
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
      const payload: Record<string,unknown> = {
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
    } catch (e: unknown) {
      const err = e as {response?:{data?:{detail?:string}};message?:string};
      setFormError(err?.response?.data?.detail || err.message || 'Create failed');
    } finally { setFormSaving(false); }
  };

  const todayPlus90 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  }, []);

  const missingName = showMapping && !columnMapping['name'];
  const remappedPreviewRows = useMemo(()=>{
    if (!showMapping || previewHeaders.length===0) return previewRows;
    const fields = (RETAIN_FIELDS as readonly string[]).filter(f=> columnMapping[f as RetainField]);
    if (fields.length===0) return [];
    return fullRows.slice(0,5).map(row=>{
      const obj: Record<string,string> = {};
      fields.forEach(f=>{
        const src = columnMapping[f as RetainField];
        obj[f]= row[src] ?? '';
      });
      return obj;
    });
  },[showMapping, columnMapping, fullRows, previewRows, previewHeaders.length]);

  const remappedHeaders = useMemo(()=>{
    if (!showMapping) return previewHeaders;
    return (RETAIN_FIELDS as readonly string[]).filter(f=> columnMapping[f as RetainField]) as string[];
  },[showMapping, columnMapping, previewHeaders]);

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
        <div className="text-xs text-slate-500 mt-1">Max 500 rows · 2MB · UTF-8 · Header must include <code className="bg-slate-100 px-1 py-0.5 rounded">name</code> (or map below)</div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50">
            <Upload className="w-3.5 h-3.5" /> Browse file
          </button>
          {file && <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-1 rounded-full">{file.name} · {(file.size / 1024).toFixed(1)}KB</span>}
          {file && <button onClick={() => { setFile(null); setPreviewRows([]); setPreviewHeaders([]); setFullRows([]); setRawText(''); setColumnMapping({} as Record<RetainField,string>); setShowMapping(false); setResult(null); setError(null); }} className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"><X className="w-4 h-4" /></button>}
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

      {/* Column Mapping UI */}
      {previewHeaders.length>0 && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold">Column Mapping</div>
              <div className="text-xs text-slate-500">Map your CSV headers → RETAINAI fields. Required: name*. Rewrites CSV client-side before upload.</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={()=> setShowMapping(v=>!v)} className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${showMapping ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{showMapping ? 'Hide mapping' : 'Map columns'}</button>
              {showMapping && <button onClick={()=>{
                const m = autoMap(previewHeaders);
                setColumnMapping(m);
              }} className="text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Auto-map</button>}
            </div>
          </div>
          <div className="text-xs text-slate-500 mb-3">Detected headers: <span className="font-mono text-slate-700">{previewHeaders.join(', ')}</span> · {fullRows.length} rows</div>
          {!showMapping ? (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Click <b>Map columns</b> if your CSV uses custom headers — e.g., <code className="bg-white px-1 py-0.5 rounded border">company → name</code>, <code className="bg-white px-1 py-0.5 rounded border">revenue → arr</code>. When hidden, upload uses original headers (requires <code className="bg-white px-1 py-0.5 rounded border">name</code>).
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(RETAIN_FIELDS as readonly string[]).map(field=>{
                  const f = field as RetainField;
                  const val = columnMapping[f] || '';
                  return (
                    <div key={field} className={`border rounded-lg p-3 ${FIELD_META[f].required ? (val ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50') : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold font-mono">{FIELD_META[f].label} {FIELD_META[f].hint && <span className="text-[11px] font-normal text-slate-500">· {FIELD_META[f].hint}</span>}</label>
                        {FIELD_META[f].required && !val && <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-full">required</span>}
                      </div>
                      <select value={val} onChange={e=> setColumnMapping(m=> ({...m, [f]: e.target.value}))} className="mt-2 w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-slate-400">
                        <option value="">— skip —</option>
                        {previewHeaders.map(h=> <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              {missingName && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />'name' must be mapped — choose which column holds the customer name.</div>}
              <div className="mt-3 text-xs text-slate-500">On upload, CSV will be rewritten: mapped headers become <span className="font-mono text-slate-700">{(RETAIN_FIELDS as readonly string[]).filter(f=>columnMapping[f as RetainField]).join(', ') || '—'}</span></div>
              {showMapping && remappedHeaders.length>0 && remappedPreviewRows.length>0 && (
                <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">Remapped preview (first 5 rows)</span>
                    <span className="text-[11px] font-mono border border-slate-200 bg-white px-2 py-0.5 rounded-full">{remappedHeaders.join(', ')}</span>
                  </div>
                  <div className="overflow-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono text-slate-500">
                        <tr>{remappedHeaders.map(h => <th key={h} className="text-left p-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {remappedPreviewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            {remappedHeaders.map(h => <td key={h} className="p-2 truncate max-w-[150px]">{r[h] || <span className="text-slate-300">—</span>}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Preview */}
      {previewRows.length > 0 && !showMapping && (
        <Card padding="p-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Preview — first {previewRows.length} rows</div>
              <div className="text-xs text-slate-500">Check columns before upload. Full file has header: {previewHeaders.join(', ')} · {fullRows.length} total rows</div>
            </div>
            <span className="text-xs font-mono border border-slate-200 bg-slate-50 px-2 py-1 rounded-full">{fullRows.length} rows</span>
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
        <div className={`border rounded-xl p-4 ${(result as {created:number}).created > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            {(result as {created:number}).created > 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
            <span className="text-sm font-semibold">{(result as {message:string}).message}</span>
            <span className="text-xs font-mono border bg-white px-2 py-0.5 rounded-full">{(result as {created:number}).created} created · {(result as {skipped:number}).skipped} skipped · {(result as {total_rows:number}).total_rows ?? (result as {created:number}).created + (result as {skipped:number}).skipped} total</span>
          </div>
          {(result as {errors?:{row:number;error:string;name?:string}[]}).errors && (result as {errors:{row:number;error:string;name?:string}[]}).errors.length > 0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-semibold">Rows skipped / errors (first {(result as {errors:unknown[]}).errors.length})</div>
              <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                {(result as {errors:{row:number;error:string;name?:string}[]}).errors.map((er, i: number) => (
                  <div key={i} className="text-xs font-mono text-slate-600">Row {er.row ?? i+2}: {er.error} {er.name ? `— ${er.name}` : ''}</div>
                ))}
              </div>
            </div>
          )}
          {(result as {created:number}).created > 0 && <div className="text-xs text-slate-600 mt-2">✓ Customers now visible in <b>Customers</b> → also <b>Data Hub → Customers</b> and <b>Data Hub → All</b> + <b>Command Center</b>. Search by name/domain. Run investigation in 360.</div>}
        </div>
      )}

      {/* Help */}
      <div className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs leading-relaxed">
        <div className="font-semibold text-white text-xs">How CSV maps to RETAINAI</div>
        <div className="mt-1 font-mono text-[11px]">name* required — domain auto from name if blank — arr/mrr numeric — health_score 0-100 auto-sets risk_level — renewal_date YYYY-MM-DD defaults +90d — segment/industry/plan/csm_* optional</div>
        <div className="mt-2 text-slate-400">Example: <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">Example Corp,example.com,Enterprise,FinTech,Enterprise Tier,180000,,Alex Morgan,alex@retainai.io,42,CRITICAL,2026-09-15,ACTIVE</code></div>
        <div className="mt-2 text-slate-500">Tip: If your export uses <code className="bg-slate-800 px-1 py-0.5 rounded">company, revenue</code> headers, open <b>Map columns</b> above and remap <code className="bg-slate-800 px-1 py-0.5 rounded">company → name</code>, <code className="bg-slate-800 px-1 py-0.5 rounded">revenue → arr</code> — upload rewrites client-side.</div>
      </div>
    </div>
  );
};
