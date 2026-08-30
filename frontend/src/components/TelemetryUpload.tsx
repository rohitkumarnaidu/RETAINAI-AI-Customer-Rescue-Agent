import React, { useState, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { Card, SectionHeader } from './ui';
import { Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2, Activity, MessageSquare, LifeBuoy, Users, RefreshCw } from 'lucide-react';

type EventTypeOpt = 'AUTO' | 'USAGE_EVENT' | 'SUPPORT_TICKET' | 'CUSTOMER_FEEDBACK' | 'ACCOUNT_EVENT';

const EVENT_META: Record<EventTypeOpt, { label: string; icon: any; desc: string; headers: string; color: string }> = {
  AUTO: { label: 'AUTO (mix)', icon: RefreshCw, desc: 'Detect per row via event_type column or headers', headers: 'customer_name, event_type, timestamp, ...any', color: 'bg-slate-900 text-white' },
  USAGE_EVENT: { label: 'Usage', icon: Activity, desc: 'DAU / clicks / sessions · any numeric proxy: orders, visits, revenue', headers: 'customer_name, daily_active_users, feature_clicks, sessions', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  SUPPORT_TICKET: { label: 'Support', icon: LifeBuoy, desc: 'Severity / subject / description · priority 1-5 auto-mapped', headers: 'customer_name, severity, subject, description', color: 'bg-red-50 border-red-200 text-red-700' },
  CUSTOMER_FEEDBACK: { label: 'Feedback', icon: MessageSquare, desc: 'Sentiment / score / text · inferred if blank', headers: 'customer_name, sentiment, score, text', color: 'bg-violet-50 border-violet-200 text-violet-700' },
  ACCOUNT_EVENT: { label: 'Account', icon: Users, desc: 'Activity / logins / meetings', headers: 'customer_name, event_type, description', color: 'bg-sky-50 border-sky-200 text-sky-700' },
};

export const TelemetryUpload: React.FC<{ onSuccess?: () => void; customerId?: string; defaultEventType?: EventTypeOpt }> = ({ onSuccess, customerId, defaultEventType = 'AUTO' }) => {
  const [eventType, setEventType] = useState<EventTypeOpt>(defaultEventType);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [fullRows, setFullRows] = useState<Record<string, string>[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f); setResult(null); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return;
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        setPreviewHeaders(headers);
        const allRows = lines.slice(1).map(line => {
          const cols: string[] = []; let cur = ''; let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (line[i+1] === '"') { cur+='"'; i++; } else inQ=!inQ; }
            else if (ch===',' && !inQ) { cols.push(cur.trim().replace(/^"|"$/g,'')); cur=''; }
            else cur+=ch;
          }
          cols.push(cur.trim().replace(/^"|"$/g,''));
          const obj: Record<string,string> = {};
          headers.forEach((h,i)=> obj[h]=(cols[i]||'').trim());
          return obj;
        }).filter(r=> Object.values(r).some(v=>v));
        setFullRows(allRows);
        setPreviewRows(allRows.slice(0,5));
      } catch {}
    };
    reader.readAsText(f);
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files?.[0]; if(f) handleFile(f); };

  const handleDownload = async (et: EventTypeOpt) => {
    try {
      const r = await api.get(`/telemetry/template/csv?event_type=${et}`);
      const data = r.data as { csv_text: string; filename: string; headers: string[] };
      const blob = new Blob([data.csv_text], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=data.filename || `retainai_telemetry_${et.toLowerCase()}_template.csv`; a.click(); URL.revokeObjectURL(url);
    } catch {
      const m = EVENT_META[et];
      const sample = m.headers.split(',').map(h=>h.trim());
      const csv = sample.join(',')+'\n'+sample.map(()=> 'sample').join(',')+'\n';
      const blob = new Blob([csv], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=`retainai_telemetry_${et.toLowerCase()}_template.csv`; a.click(); URL.revokeObjectURL(url);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('event_type', eventType);
      if (customerId) fd.append('customer_id', customerId);
      const r = await api.post('/telemetry/upload', fd, { headers: {'Content-Type':'multipart/form-data'}});
      setResult(r.data);
      if ((r.data as any).created >0 && onSuccess) onSuccess();
    } catch (e:any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || e.message || 'Upload failed';
      setError(typeof msg==='string'? msg: JSON.stringify(msg));
    } finally { setUploading(false); }
  };

  const detectedInfo = useMemo(()=>{
    if (previewHeaders.length===0) return null;
    const lower = previewHeaders.map(h=>h.toLowerCase());
    const hasCustomer = lower.some(h=> ['customer_name','customer','company','account','customer_id'].includes(h));
    const hasEventTypeCol = lower.includes('event_type') || lower.includes('type');
    const hasUsage = lower.some(h=> ['dau','daily_active_users','daily_users','wau','mau','feature_clicks','sessions','orders','transactions','visits','revenue','amount'].includes(h));
    const hasSupport = lower.some(h=> ['subject','severity','priority','ticket_subject','issue'].includes(h));
    const hasFeedback = lower.some(h=> ['sentiment','feedback','review','nps','csat','score'].includes(h));
    return { hasCustomer, hasEventTypeCol, hasUsage, hasSupport, hasFeedback, total: fullRows.length };
  },[previewHeaders, fullRows.length]);

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Telemetry Upload — any dataset shape" subtitle="AUTO detects per-row type from event_type column or headers. Any extra columns preserved as metadata_json and visible in timeline." icon={Upload} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EVENT_META) as EventTypeOpt[]).map(et=>{
            const m = EVENT_META[et];
            const active = eventType===et;
            return (
              <button key={et} onClick={()=> setEventType(et)} className={`px-3 py-2 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 ${active ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <m.icon className="w-3.5 h-3.5" /> {m.label}
              </button>
            )
          })}
        </div>
        <div className={`mt-3 text-xs border rounded-lg p-2.5 ${EVENT_META[eventType].color} border`}>
          <span className="font-semibold">{EVENT_META[eventType].label}:</span> {EVENT_META[eventType].desc} · Expected: <code className="bg-white/70 px-1 rounded font-mono">{EVENT_META[eventType].headers}</code>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(EVENT_META) as EventTypeOpt[]).map(et=>(
            <button key={et} onClick={()=> handleDownload(et)} className="inline-flex items-center gap-1 border border-slate-200 bg-white px-2.5 py-1 rounded-lg text-xs hover:bg-slate-50">
              <Download className="w-3 h-3"/> {et} template
            </button>
          ))}
        </div>
        {customerId && <div className="mt-2 text-xs text-slate-600">Uploading for <span className="font-mono font-semibold">{customerId}</span> — customer_name column optional (will default to this customer).</div>}
      </Card>

      <div
        onDragOver={e=>{e.preventDefault(); setDragOver(true);}}
        onDragLeave={()=> setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition ${dragOver ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'} ${file?'bg-slate-50':''}`}
      >
        <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto"><FileSpreadsheet className="w-6 h-6"/></div>
        <div className="mt-3 text-sm font-semibold">Drop telemetry CSV here or browse</div>
        <div className="text-xs text-slate-500 mt-1">Max 800 rows · 3MB · Handles <b>any headers</b> via alias mapping + AUTO detection. Must include <code className="bg-slate-100 px-1 rounded">customer_name</code> or <code className="bg-slate-100 px-1 rounded">customer_id</code> {customerId ? '(or will use selected customer)' : '(or will error)'}.</div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) handleFile(f);}}/>
          <button onClick={()=> inputRef.current?.click()} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50"><Upload className="w-3.5 h-3.5"/> Browse</button>
          {file && <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-1 rounded-full">{file.name} · {(file.size/1024).toFixed(1)}KB · {fullRows.length} rows</span>}
          {file && <button onClick={()=>{setFile(null); setPreviewRows([]); setPreviewHeaders([]); setFullRows([]); setResult(null); setError(null);}} className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"><X className="w-4 h-4"/></button>}
        </div>
        {file && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={handleUpload} disabled={uploading} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>} {uploading ? 'Uploading…' : `Upload ${eventType} · ${fullRows.length} rows`}
            </button>
          </div>
        )}
      </div>

      {previewHeaders.length>0 && detectedInfo && (
        <Card>
          <div className="text-sm font-semibold">Detected mapping preview</div>
          <div className="text-xs text-slate-500 mt-1">Headers: <span className="font-mono text-slate-700">{previewHeaders.join(', ')}</span> · {detectedInfo.total} rows</div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <span className={`px-2 py-1 rounded-full border ${detectedInfo.hasCustomer ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{detectedInfo.hasCustomer ? '✓ customer identifier found' : '⚠ missing customer_name/id (or will use selected)'}</span>
            {eventType==='AUTO' && <span className={`px-2 py-1 rounded-full border ${detectedInfo.hasEventTypeCol ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200'}`}>{detectedInfo.hasEventTypeCol ? 'event_type column present' : 'no event_type col — auto via headers'}</span>}
            <span className={`px-2 py-1 rounded-full border ${detectedInfo.hasUsage ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200'}`}>usage-like: {detectedInfo.hasUsage?'yes':'no'}</span>
            <span className={`px-2 py-1 rounded-full border ${detectedInfo.hasSupport ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200'}`}>support-like: {detectedInfo.hasSupport?'yes':'no'}</span>
            <span className={`px-2 py-1 rounded-full border ${detectedInfo.hasFeedback ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-slate-50 border-slate-200'}`}>feedback-like: {detectedInfo.hasFeedback?'yes':'no'}</span>
            <span className="px-2 py-1 rounded-full border bg-slate-900 text-white">→ {eventType==='AUTO' ? 'AUTO will route per row' : eventType}</span>
          </div>
          {eventType==='AUTO' && !detectedInfo.hasEventTypeCol && (
            <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">AUTO without <code>event_type</code> column will infer from headers per row: <code>subject/severity → SUPPORT_TICKET</code>, <code>sentiment/text → FEEDBACK</code>, <code>dau/orders → USAGE_EVENT</code>. Or set explicit type above.</div>
          )}
        </Card>
      )}

      {previewRows.length>0 && (
        <Card padding="p-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div><div className="text-sm font-semibold">Preview — first {previewRows.length} rows</div><div className="text-xs text-slate-500">Check customer mapping before upload. Full: {fullRows.length} rows</div></div>
            <span className="text-xs font-mono border border-slate-200 bg-slate-50 px-2 py-1 rounded-full">{previewHeaders.join(', ').slice(0,60)}...</span>
          </div>
          <div className="overflow-auto max-h-56">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-mono text-slate-500">
                <tr>{previewHeaders.map(h=> <th key={h} className="text-left p-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((r,i)=>(
                  <tr key={i} className="hover:bg-slate-50">{previewHeaders.map(h=> <td key={h} className="p-2 truncate max-w-[150px]">{r[h] || <span className="text-slate-300">—</span>}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5"/>
          <div className="flex-1"><div className="text-sm font-semibold text-red-800">Upload failed</div><div className="text-xs text-red-700 mt-1 whitespace-pre-wrap">{error}</div></div>
        </div>
      )}
      {result && (
        <div className={`border rounded-xl p-4 ${(result as any).created >0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            {(result as any).created>0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600"/> : <AlertTriangle className="w-5 h-5 text-amber-600"/>}
            <span className="text-sm font-semibold">{(result as any).message}</span>
            <span className="text-xs font-mono border bg-white px-2 py-0.5 rounded-full">{(result as any).created} created · {(result as any).skipped} skipped · {(result as any).total_rows} total</span>
          </div>
          {(result as any).affected_customers?.length>0 && <div className="text-xs text-slate-600 mt-2">Affected: {(result as any).affected_customers.slice(0,5).join(', ')} · Reassessed {(result as any).reassessed} customers — health/risk updated, run investigation to see.</div>}
          {(result as any).errors?.length>0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-semibold">Rows skipped / errors (first {(result as any).errors.length})</div>
              <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                {(result as any).errors.map((er:any,i:number)=> <div key={i} className="text-xs font-mono text-slate-600">Row {er.row ?? i+2}: {er.error}</div>)}
              </div>
            </div>
          )}
          {(result as any).created>0 && <div className="text-xs text-slate-600 mt-2">Telemetry now visible in <b>Customer 360 → Timeline</b> + <b>Evidence</b>. Run <b>Run investigation</b> to generate dynamic root cause.</div>}
        </div>
      )}

      <div className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs leading-relaxed">
        <div className="font-semibold text-white">How telemetry maps flexibly</div>
        <div className="mt-1 font-mono text-[11px]">
          <div>Usage: <code className="bg-slate-800 px-1 rounded">dau → daily_active_users</code> also <code className="bg-slate-800 px-1 rounded">orders, visits, transactions → dau fallback</code> · revenue/amount → feature_clicks</div>
          <div>Support: <code className="bg-slate-800 px-1 rounded">priority 1-5 → severity</code> · any subject/description</div>
          <div>Feedback: <code className="bg-slate-800 px-1 rounded">nps/score 1-10 → sentiment inferred</code> · empty sentiment inferred from text keywords</div>
          <div>Extra columns: preserved as <code className="bg-slate-800 px-1 rounded">metadata_json</code> and shown in timeline details.</div>
        </div>
      </div>
    </div>
  );
};