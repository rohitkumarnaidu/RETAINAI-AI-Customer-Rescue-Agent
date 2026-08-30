import React, {useState, useEffect, useMemo} from 'react';
import { getCustomers } from '../services/api';
import { RiskBadge, HealthRing } from './RiskBadge';
import { Card, ErrorState, SkeletonCard, EmptyState } from './ui';
import { CsvUpload } from './CsvUpload';
import { TelemetryUpload } from './TelemetryUpload';
import { Search, ArrowUpRight, SlidersHorizontal, Upload, X, RefreshCw, Activity } from 'lucide-react';

export const CustomersView: React.FC<{onSelectCustomer:(id:string)=>void; initialShowImport?:boolean; onImportConsumed?:()=>void}> = ({onSelectCustomer, initialShowImport, onImportConsumed})=>{
  const [customers,setCustomers]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [q,setQ]=useState(''); const [seg,setSeg]=useState('ALL'); const [risk,setRisk]=useState('ALL'); const [sort,setSort]=useState<'name'|'health'|'arr'>('name');
  const [dataset,setDataset]=useState<'all'|'customers'|'usage'|'support'|'feedback'>('all');

  // Phase 5: tenant-aware cache key — isolates per tenant without react-query/SWR
  const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('retainai_tenant_id') || localStorage.getItem('tenant_id') || localStorage.getItem('tenantId') || 'demo-tenant-001') : 'demo-tenant-001';
  const cacheKey = `customers:${tenantId}`;
  const load=async()=>{ try{setLoading(true); const c=await getCustomers(); setCustomers(c);}catch(e:any){setError(e?.response?.data?.detail || e.message)} finally{setLoading(false)} };
  useEffect(()=>{ load(); },[cacheKey]);

  const segs = useMemo(()=> Array.from(new Set(customers.map((c:any)=>c.segment))).filter(Boolean),[customers]);

  const filtered = useMemo(()=>{
    let out=[...customers];
    if(q) out=out.filter(c=> c.name.toLowerCase().includes(q.toLowerCase()) || c.domain.toLowerCase().includes(q.toLowerCase()) || c.industry.toLowerCase().includes(q.toLowerCase()));
    if(seg!=='ALL') out=out.filter(c=>c.segment===seg);
    if(risk!=='ALL') out=out.filter(c=>c.risk_level===risk);
    if(dataset!=='all'){
      if(dataset==='usage') out=out.filter(c=> (c.health_score??100) < 75);
      else if(dataset==='support') out=out.filter(c=> ['AT_RISK','HIGH_RISK','CRITICAL'].includes(c.risk_level));
      else if(dataset==='feedback') out=out.filter(c=> (c.health_score??100) >=40 && (c.health_score??100) <=85);
    }
    if(sort==='health') out.sort((a,b)=>a.health_score-b.health_score);
    else if(sort==='arr') out.sort((a,b)=>b.arr-a.arr);
    else out.sort((a,b)=>a.name.localeCompare(b.name));
    return out;
  },[customers,q,seg,risk,sort,dataset]);

  const [page,setPage]=useState(1); const pageSize=20;
  const [showImport,setShowImport]=useState(!!initialShowImport);
  const [importTab,setImportTab]=useState<'customers'|'telemetry'>('customers');
  const [toast,setToast]=useState<string|null>(null);
  useEffect(()=>{ if(initialShowImport){ setShowImport(true); onImportConsumed?.(); }},[initialShowImport]);
  const fmtDate=(s:string)=>{ try{ const d=new Date(s); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch{return s}};
  const fmtARR=(n:number)=> {
    const v = Math.round(Number(n)||0);
    if (v>=1000) return `$${(v/1000).toFixed(0)}k`;
    return `$${v.toLocaleString()}`;
  };
  const fmtMoneyFull=(n:number)=> `$${Math.round(Number(n)||0).toLocaleString()}`;
  if(loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load} />;

  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const paged=filtered.slice(0, page*pageSize);
  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">Customers</h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed truncate" title={`${filtered.length} of ${customers.length}`}>{filtered.length} of {customers.length} · Search, filter, sort — real backend data · Updated {new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {(['all','customers','usage','support','feedback'] as const).map(f=>(
              <button key={f} onClick={()=> setDataset(f)} className={`px-3 py-1 rounded-full text-xs font-mono border capitalize ${dataset===f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{f==='all' ? 'All 4' : f}</button>
            ))}
            <span className="text-xs text-slate-500 self-center ml-1">{dataset==='all' ? 'all datasets' : dataset} · {filtered.length} shown</span>
          </div>
          <div className="flex flex-col xl:flex-row gap-2 xl:items-center xl:justify-between">
            <div className="relative flex-1 min-w-0 xl:max-w-[320px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0"/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search accounts, domain, industry..." className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 placeholder:text-slate-400 truncate"/>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={seg} onChange={e=>setSeg(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-400 min-w-[130px] max-w-[160px] truncate">
                <option value="ALL">All segments</option>
                {segs.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={risk} onChange={e=>setRisk(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-400 min-w-[110px] max-w-[140px] truncate">
                <option value="ALL">All risk</option><option>CRITICAL</option><option>WATCH</option><option>HEALTHY</option><option>AT_RISK</option><option>HIGH_RISK</option>
              </select>
              <select value={sort} onChange={e=>setSort(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-400 min-w-[130px] max-w-[150px] truncate">
                <option value="name">Sort: Name</option><option value="health">Sort: Health ↑</option><option value="arr">Sort: ARR ↓</option>
              </select>
              <button onClick={load} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 whitespace-nowrap shrink-0"><RefreshCw className="w-3.5 h-3.5 shrink-0" /> Refresh</button>
              <button onClick={()=>setShowImport(v=>!v)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 ${showImport ? 'bg-slate-900 text-white border-slate-900' : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'}`}>
                {showImport ? <X className="w-3.5 h-3.5 shrink-0" /> : <Upload className="w-3.5 h-3.5 shrink-0" />} {showImport ? 'Close import' : 'Import CSV / Add customer'}
              </button>
            </div>
          </div>
        </div>
        {customers.length===0 && !loading && !error && (
          <EmptyState title="No customers yet" description="No accounts in portfolio. Import CSV or add a customer to get started. Your data will appear here with dynamic health/risk computed instantly." action={<button onClick={()=>setShowImport(true)} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm">Import CSV / Add customer</button>} />
        )}
        {showImport && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {toast && <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-lg">{toast}</div>}
            <div className="flex gap-2 mb-4">
              <button onClick={()=> setImportTab('customers')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${importTab==='customers' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>Customers CSV</button>
              <button onClick={()=> setImportTab('telemetry')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1 ${importTab==='telemetry' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}><Activity className="w-3 h-3"/> Telemetry CSV (any shape)</button>
            </div>
            {importTab==='customers' ? (
              <CsvUpload onSuccess={async()=>{ await load(); setToast('Customers added — portfolio updated'); setTimeout(()=>setToast(null),3000); }} onClose={()=>setShowImport(false)} />
            ) : (
              <TelemetryUpload onSuccess={async()=>{ await load(); setToast('Telemetry uploaded — health/risk reassessed, open 360 to investigate'); setTimeout(()=>setToast(null),4000); }} />
            )}
          </div>
        )}
      </Card>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[640px] scrollbar-thin">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs font-mono text-slate-500">
              <tr><th className="text-left p-3 whitespace-nowrap min-w-[180px]">Account</th><th className="text-left p-3 whitespace-nowrap min-w-[140px]">Segment</th><th className="text-left p-3 whitespace-nowrap w-[84px]">Health</th><th className="text-left p-3 whitespace-nowrap w-[110px]">Risk</th><th className="text-left p-3 whitespace-nowrap w-[90px]">ARR</th><th className="text-left p-3 whitespace-nowrap w-[130px]">Renewal</th>{customers.some((c:any)=> c.metadata_json && Object.keys(c.metadata_json).length>0) && <th className="text-left p-3 whitespace-nowrap min-w-[140px]">Extras (dynamic)</th>}<th className="p-3 w-[90px]"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((c:any)=>{
                const extras = c.metadata_json && typeof c.metadata_json === 'object' ? Object.entries(c.metadata_json) : [];
                return (
                <tr key={c.id} onClick={()=>onSelectCustomer(c.id)} className="hover:bg-slate-50 cursor-pointer group">
                  <td className="p-3 align-middle min-w-0"><div className="font-medium leading-tight truncate max-w-[180px]" title={c.name}>{c.name}</div><div className="text-xs text-slate-500 font-mono leading-tight truncate max-w-[180px]" title={`${c.domain} · ${c.industry}`}>{c.domain} · {c.industry}</div></td>
                  <td className="p-3 align-middle text-xs whitespace-nowrap"><span className="truncate max-w-[120px] inline-block align-middle" title={c.segment}>{c.segment}</span><div className="text-[11px] text-slate-400 truncate max-w-[140px] leading-tight" title={c.plan}>{c.plan}</div></td>
                  <td className="p-3 align-middle"><HealthRing score={c.health_score} size={32}/></td>
                  <td className="p-3 align-middle"><RiskBadge level={c.risk_level} size="sm"/></td>
                  <td className="p-3 align-middle font-mono text-xs whitespace-nowrap" title={fmtMoneyFull(c.arr)}>{fmtARR(c.arr)}</td>
                  <td className="p-3 align-middle text-xs whitespace-nowrap"><span className="leading-tight">{fmtDate(c.renewal_date)}</span><div className="text-[11px] text-slate-400 leading-tight">{c.lifecycle_stage}</div></td>
                  {customers.some((cc:any)=> cc.metadata_json && Object.keys(cc.metadata_json).length>0) && (
                    <td className="p-3 align-middle">
                      {extras.length>0 ? (
                        <div className="text-xs">
                          <div className="flex flex-wrap gap-1">
                            {extras.slice(0,2).map(([k,v]:any)=> <span key={k} className="bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-mono truncate max-w-[80px]">{k}: {String(v).slice(0,15)}</span>)}
                            {extras.length>2 && <span className="text-[11px] text-slate-400">+{extras.length-2}</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{extras.length} extra fields</div>
                        </div>
                      ) : <span className="text-[11px] text-slate-300">—</span>}
                    </td>
                  )}
                  <td className="p-3 align-middle text-right whitespace-nowrap"><span className="inline-flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-white whitespace-nowrap group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-colors">Open <ArrowUpRight className="w-3 h-3 shrink-0"/></span></td>
                </tr>
                );
              })}
              {filtered.length===0 && <tr><td colSpan={customers.some((c:any)=> c.metadata_json && Object.keys(c.metadata_json).length>0) ? 8 : 7} className="p-8 text-center"><div className="text-sm text-slate-500">No results — adjust filters.</div><button onClick={()=>{setQ('');setSeg('ALL');setRisk('ALL');setSort('name');setDataset('all');}} className="mt-2 text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Clear filters</button></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 min-w-0"><SlidersHorizontal className="w-3.5 h-3.5 shrink-0"/> <span className="truncate">{paged.length} of {filtered.length} shown · Sorted by {sort} · Page {page}/{totalPages}</span></span>{paged.length < filtered.length && <button onClick={()=> setPage(p=> p+1)} className="border border-slate-200 bg-white px-3 py-1 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0">Load more</button>}</div>
      </div>
    </div>
  );
};
