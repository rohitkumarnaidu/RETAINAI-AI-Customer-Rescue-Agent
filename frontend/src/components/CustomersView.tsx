import React, {useState, useEffect, useMemo} from 'react';
import { getCustomers } from '../services/api';
import { RiskBadge, HealthRing } from './RiskBadge';
import { Card, ErrorState, SkeletonCard, EmptyState } from './ui';
import { CsvUpload } from './CsvUpload';
import { Search, ArrowUpRight, SlidersHorizontal, Upload, X, RefreshCw } from 'lucide-react';

export const CustomersView: React.FC<{onSelectCustomer:(id:string)=>void; initialShowImport?:boolean; onImportConsumed?:()=>void}> = ({onSelectCustomer, initialShowImport, onImportConsumed})=>{
  const [customers,setCustomers]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [q,setQ]=useState(''); const [seg,setSeg]=useState('ALL'); const [risk,setRisk]=useState('ALL'); const [sort,setSort]=useState<'name'|'health'|'arr'>('name');

  const load=async()=>{ try{setLoading(true); const c=await getCustomers(); setCustomers(c);}catch(e:any){setError(e.message)} finally{setLoading(false)} };
  useEffect(()=>{load()},[]);

  const segs = useMemo(()=> Array.from(new Set(customers.map((c:any)=>c.segment))).filter(Boolean),[customers]);

  const filtered = useMemo(()=>{
    let out=[...customers];
    if(q) out=out.filter(c=> c.name.toLowerCase().includes(q.toLowerCase()) || c.domain.toLowerCase().includes(q.toLowerCase()) || c.industry.toLowerCase().includes(q.toLowerCase()));
    if(seg!=='ALL') out=out.filter(c=>c.segment===seg);
    if(risk!=='ALL') out=out.filter(c=>c.risk_level===risk);
    if(sort==='health') out.sort((a,b)=>a.health_score-b.health_score);
    else if(sort==='arr') out.sort((a,b)=>b.arr-a.arr);
    else out.sort((a,b)=>a.name.localeCompare(b.name));
    return out;
  },[customers,q,seg,risk,sort]);

  const [page,setPage]=useState(1); const pageSize=20;
  const [showImport,setShowImport]=useState(!!initialShowImport);
  const [toast,setToast]=useState<string|null>(null);
  useEffect(()=>{ if(initialShowImport){ setShowImport(true); onImportConsumed?.(); }},[initialShowImport]);
  const fmtDate=(s:string)=>{ try{ const d=new Date(s); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch{return s}};
  const fmtARR=(n:number)=> n>=1000? `$${(n/1000).toFixed(0)}k` : `$${n.toLocaleString()}`;
  if(loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load} />;

  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const paged=filtered.slice(0, page*pageSize);
  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Customers</h2>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} of {customers.length} · Search, filter, sort — real backend data · Updated {new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
          </div>
          <div className="flex flex-col xl:flex-row gap-2 xl:items-center xl:justify-between">
            <div className="relative flex-1 min-w-0 xl:max-w-[320px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search accounts, domain, industry..." className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 placeholder:text-slate-400"/>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={seg} onChange={e=>setSeg(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-400 min-w-[130px]">
                <option value="ALL">All segments</option>
                {segs.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={risk} onChange={e=>setRisk(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-400 min-w-[110px]">
                <option value="ALL">All risk</option><option>CRITICAL</option><option>WATCH</option><option>HEALTHY</option><option>AT_RISK</option><option>HIGH_RISK</option>
              </select>
              <select value={sort} onChange={e=>setSort(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-400 min-w-[130px]">
                <option value="name">Sort: Name</option><option value="health">Sort: Health ↑</option><option value="arr">Sort: ARR ↓</option>
              </select>
              <button onClick={load} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 whitespace-nowrap"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
              <button onClick={()=>setShowImport(v=>!v)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap ${showImport ? 'bg-slate-900 text-white border-slate-900' : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'}`}>
                {showImport ? <X className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />} {showImport ? 'Close import' : 'Import CSV / Add customer'}
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
            <CsvUpload onSuccess={async()=>{ await load(); setToast('Customers added — portfolio updated'); setTimeout(()=>setToast(null),3000); }} onClose={()=>setShowImport(false)} />
          </div>
        )}
      </Card>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[640px]">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-mono text-slate-500">
              <tr><th className="text-left p-3 whitespace-nowrap min-w-[180px]">Account</th><th className="text-left p-3 whitespace-nowrap min-w-[140px]">Segment</th><th className="text-left p-3 whitespace-nowrap w-[84px]">Health</th><th className="text-left p-3 whitespace-nowrap w-[110px]">Risk</th><th className="text-left p-3 whitespace-nowrap w-[90px]">ARR</th><th className="text-left p-3 whitespace-nowrap w-[130px]">Renewal</th><th className="p-3 w-[90px]"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((c:any)=>(
                <tr key={c.id} onClick={()=>onSelectCustomer(c.id)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="p-3 align-middle"><div className="font-medium leading-tight truncate max-w-[180px]">{c.name}</div><div className="text-xs text-slate-500 font-mono leading-tight truncate max-w-[180px]">{c.domain} · {c.industry}</div></td>
                  <td className="p-3 align-middle text-xs whitespace-nowrap">{c.segment}<div className="text-[11px] text-slate-400 truncate max-w-[140px]">{c.plan}</div></td>
                  <td className="p-3 align-middle"><HealthRing score={c.health_score} size={32}/></td>
                  <td className="p-3 align-middle"><RiskBadge level={c.risk_level} size="sm"/></td>
                  <td className="p-3 align-middle font-mono text-xs whitespace-nowrap">{fmtARR(c.arr)}</td>
                  <td className="p-3 align-middle text-xs whitespace-nowrap">{fmtDate(c.renewal_date)}<div className="text-[11px] text-slate-400">{c.lifecycle_stage}</div></td>
                  <td className="p-3 align-middle text-right"><span className="inline-flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-white whitespace-nowrap">Open <ArrowUpRight className="w-3 h-3"/></span></td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={7} className="p-8 text-center"><div className="text-sm text-slate-500">No results — adjust filters.</div><button onClick={()=>{setQ('');setSeg('ALL');setRisk('ALL');setSort('name');}} className="mt-2 text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Clear filters</button></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between"><span className="flex items-center gap-2"><SlidersHorizontal className="w-3.5 h-3.5"/> {paged.length} of {filtered.length} shown · Sorted by {sort} · Page {page}/{totalPages}</span>{paged.length < filtered.length && <button onClick={()=> setPage(p=> p+1)} className="border border-slate-200 bg-white px-3 py-1 rounded-lg hover:bg-slate-50">Load more</button>}</div>
      </div>
    </div>
  );
};
