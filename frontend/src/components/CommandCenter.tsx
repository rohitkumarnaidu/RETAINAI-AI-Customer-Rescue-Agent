import React, { useState, useEffect, useMemo } from 'react';
import { getPortfolio } from '../services/api';
import { RiskBadge, HealthRing } from './RiskBadge';
import { Card, SkeletonCard, ErrorState } from './ui';
import { ArrowUpRight, TrendingDown, ShieldAlert, Activity, Clock, Search, Filter, Upload, FileSpreadsheet } from 'lucide-react';

export const CommandCenter: React.FC<{onSelectCustomer:(id:string)=>void}> = ({onSelectCustomer})=>{
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');

  const load = async()=>{
    try{ setLoading(true); setError(null); const p=await getPortfolio(); setData(p); }
    catch(e:any){ setError(e.message||'Failed to load'); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  const customers: any[] = data?.customers || [];
  const metrics = data?.metrics || {};

  const filtered = useMemo(()=>{
    return customers.filter((c:any)=>{
      const matchesQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.domain.toLowerCase().includes(q.toLowerCase()) || c.csm_name?.toLowerCase().includes(q.toLowerCase());
      const matchesRisk = riskFilter==='ALL' || (c.risk_level||'HEALTHY')===riskFilter;
      return matchesQ && matchesRisk;
    }).sort((a:any,b:any)=>{
      const order:any = {CRITICAL:0, HIGH_RISK:1, AT_RISK:2, WATCH:3, STABLE:4, HEALTHY:5};
      return (order[a.risk_level]??9) - (order[b.risk_level]??9);
    });
  },[customers,q,riskFilter]);

  const critical = customers.filter((c:any)=>['CRITICAL','HIGH_RISK'].includes(c.risk_level));
  const watch = customers.filter((c:any)=>['WATCH','AT_RISK'].includes(c.risk_level));
  const healthy = customers.filter((c:any)=>c.risk_level==='HEALTHY');
  const totalARR = customers.reduce((s:any,c:any)=>s+(c.arr||0),0);
  const atRiskARR = [...critical,...watch].reduce((s:any,c:any)=>s+(c.arr||0),0);
  const acme = customers.find((c:any)=>c.id==='acme-corp-001' || c.name.toLowerCase().includes('acme'));

  if(loading) return <div aria-live="polite" aria-busy="true" className="grid grid-cols-1 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono tracking-wide text-slate-500">CURRENT SITUATION · Monitoring active</div>
          <h1 className="text-xl font-semibold tracking-tight mt-1">
            {critical.length >0 ? `${critical.length} customers need immediate attention` : watch.length>0 ? `${watch.length} on watchlist — early signals detected` : 'No customers currently need intervention'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {critical.length} critical · {watch.length} watch · {healthy.length} healthy · {(atRiskARR/1000).toFixed(0)}k ARR at risk · {customers.length} total accounts
          </p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><FileSpreadsheet className="w-3 h-3" /> Have your own data? Go to <b>Customers</b> → <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium"><Upload className="w-3 h-3" /> Import CSV / Add customer</span> — now supports live data, not just demo 101.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=> acme && onSelectCustomer(acme.id)} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
            Open Acme 360 <ArrowUpRight className="w-4 h-4" />
          </button>
          <button onClick={load} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm hover:bg-slate-50"><Clock className="w-4 h-4 text-slate-500"/>Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs font-mono text-slate-500">TOTAL ARR</div>
          <div className="text-2xl font-semibold mt-1">${(totalARR/1000).toFixed(0)}k</div>
          <div className="text-xs text-slate-500 mt-1">{customers.length} accounts</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-red-500"/> ARR AT RISK</div>
          <div className="text-2xl font-semibold mt-1 text-red-600">${(atRiskARR/1000).toFixed(0)}k</div>
          <div className="text-xs text-slate-500 mt-1">{totalARR? ((atRiskARR/totalARR)*100).toFixed(1):0}% of portfolio</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-red-500"/> CRITICAL</div>
          <div className="text-2xl font-semibold mt-1">{critical.length}</div>
          <div className="text-xs text-slate-500 mt-1">Immediate investigation</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-amber-500"/> WATCHLIST</div>
          <div className="text-2xl font-semibold mt-1">{watch.length}</div>
          <div className="text-xs text-slate-500 mt-1">Early warning</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1" padding="p-0">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold">Needs attention</h3>
            <p className="text-xs text-slate-500">Highest risk first — sorted by risk level</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-auto">
            {critical.slice(0,8).map((c:any)=>(
              <button key={c.id} onClick={()=>onSelectCustomer(c.id)} className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3">
                <HealthRing score={c.health_score} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-slate-500 truncate">{c.domain} · {c.segment}</div>
                </div>
                <RiskBadge level={c.risk_level} size="sm" />
              </button>
            ))}
            {critical.length===0 && <div className="p-6 text-xs text-slate-500 text-center">No critical accounts — watchlist below</div>}
            {critical.length===0 && watch.slice(0,6).map((c:any)=>(
              <button key={c.id} onClick={()=>onSelectCustomer(c.id)} className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3">
                <HealthRing score={c.health_score} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-slate-500 truncate">{c.segment} · {c.csm_name}</div>
                </div>
                <RiskBadge level={c.risk_level} size="sm" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-2" padding="p-0">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Customer portfolio</h3>
              <p className="text-xs text-slate-500">{filtered.length} of {customers.length} accounts</p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-56">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <input aria-label="Filter accounts or CSMs" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search account, domain, CSM" className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-slate-400" />
              </div>
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                {['ALL','CRITICAL','WATCH','HEALTHY'].map(l=>(
                  <button key={l} onClick={()=>setRiskFilter(l)} className={`px-2.5 py-1 rounded-md text-xs font-medium ${riskFilter===l ? 'bg-slate-900 text-white':'text-slate-600 hover:bg-white'}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-mono text-slate-500">
                <tr><th className="text-left p-3 font-medium">Account</th><th className="text-left p-3 font-medium">Risk</th><th className="text-left p-3 font-medium">Health</th><th className="text-left p-3 font-medium">ARR</th><th className="text-left p-3 font-medium">CSM</th><th className="p-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c:any)=>{
                  const isAcme=c.name.toLowerCase().includes('acme');
                  return (
                    <tr key={c.id} onClick={()=>onSelectCustomer(c.id)} role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); onSelectCustomer(c.id); } }} className={`hover:bg-slate-50 cursor-pointer ${isAcme ? 'bg-amber-50/60':''}`}>
                      <td className="p-3">
                        <div className="font-medium flex items-center gap-1.5">{c.name} {isAcme && <span className="text-[10px] border border-amber-200 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono">HERO</span>}</div>
                        <div className="text-xs text-slate-500 font-mono">{c.domain} · {c.segment}</div>
                      </td>
                      <td className="p-3"><RiskBadge level={c.risk_level||'HEALTHY'} size="sm" /></td>
                      <td className="p-3"><span className={`text-sm font-semibold ${c.health_score<50?'text-red-600': c.health_score<75?'text-amber-600':'text-teal-700'}`}>{Math.round(c.health_score)}</span><span className="text-xs text-slate-400">/100</span></td>
                      <td className="p-3 font-mono text-xs">${(c.arr||0).toLocaleString()}</td>
                      <td className="p-3 text-xs text-slate-600">{c.csm_name}<div className="text-[11px] text-slate-400">{c.industry}</div></td>
                      <td className="p-3 text-right"><span className="inline-flex items-center gap-1 text-xs border border-slate-200 bg-white px-2.5 py-1 rounded-lg">360 <ArrowUpRight className="w-3 h-3"/></span></td>
                    </tr>
                  );
                })}
                {filtered.length===0 && <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-500">No accounts match filters</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2"><Filter className="w-3.5 h-3.5"/> Risk distribution: {Object.entries(metrics.risk_distribution||{}).map(([k,v])=>`${k} ${v}`).join(' · ') || '—'}</div>
        </Card>
      </div>

      {acme && (
        <div className="bg-[#0F172A] text-white rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono tracking-wide text-slate-400">FEATURED BENCHMARK · Acme Corp</div>
            <div className="text-lg font-semibold mt-1">{acme.name} — ${acme.arr.toLocaleString()} ARR</div>
            <div className="text-sm text-slate-300 mt-1">{acme.domain} · {acme.segment} · CSM {acme.csm_name} · Health {Math.round(acme.health_score)}/100</div>
          </div>
          <button onClick={()=>onSelectCustomer(acme.id)} className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-100">Launch Acme 360 Rescue →</button>
        </div>
      )}
    </div>
  );
};
