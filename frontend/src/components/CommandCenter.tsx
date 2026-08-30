import React, { useState, useEffect } from 'react';
import { getPortfolio } from '../services/api';
import { RiskBadge, HealthRing } from './RiskBadge';
import { Card, SkeletonCard, ErrorState, EmptyState } from './ui';
import { TrendingDown, ShieldAlert, Activity, Clock, ArrowUpRight, FileSpreadsheet, Upload } from 'lucide-react';

export const CommandCenter: React.FC<{onSelectCustomer:(id:string)=>void}> = ({onSelectCustomer})=>{
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async()=>{
    try{ setLoading(true); setError(null); const p=await getPortfolio(); setData(p); }
    catch(e:any){ setError(e.message||'Failed to load'); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  const customers: any[] = data?.customers || [];
  const critical = customers.filter((c:any)=>['CRITICAL','HIGH_RISK'].includes(c.risk_level));
  const watch = customers.filter((c:any)=>['WATCH','AT_RISK'].includes(c.risk_level));
  const healthy = customers.filter((c:any)=>c.risk_level==='HEALTHY');
  const totalARR = customers.reduce((s:any,c:any)=>s+(c.arr||0),0);
  const atRiskARR = [...critical,...watch].reduce((s:any,c:any)=>s+(c.arr||0),0);
  const hero = (()=>{
    if(customers.length===0) return null;
    const crit = customers.find((c:any)=>c.risk_level==='CRITICAL');
    if(crit) return crit;
    const order:any={CRITICAL:0,HIGH_RISK:1,AT_RISK:2,WATCH:3,STABLE:4,HEALTHY:5};
    return [...customers].sort((a:any,b:any)=>(order[a.risk_level]??9)-(order[b.risk_level]??9) || (a.health_score-b.health_score))[0] || null;
  })();

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
          {hero ? (
            <button onClick={()=> hero && onSelectCustomer(hero.id)} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
              Open highest risk 360 <ArrowUpRight className="w-4 h-4" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-slate-300">— No hero</span>
          )}
          <button onClick={load} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm hover:bg-slate-50"><Clock className="w-4 h-4 text-slate-500"/>Refresh</button>
        </div>
      </div>

      {customers.length===0 && (
        <EmptyState title="No customers yet" description="No accounts in portfolio. Use Customers tab to import CSV or add a customer, then health/risk will compute dynamically." />
      )}
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

      <Card padding="p-0">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Needs attention</h3>
            <p className="text-xs text-slate-500">Highest risk first — sorted by risk level · Full portfolio in <b>Customers</b>, visuals in <b>Analytics</b></p>
          </div>
          <button onClick={load} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"><Clock className="w-3 h-3" />Refresh</button>
        </div>
        <div className="divide-y divide-slate-100 max-h-[420px] overflow-auto">
          {critical.slice(0,8).map((c:any)=>(
            <button key={c.id} onClick={()=>onSelectCustomer(c.id)} className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3">
              <HealthRing score={c.health_score} size={44} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-slate-500 truncate">{c.domain} · {c.segment} · {c.csm_name}</div>
              </div>
              <RiskBadge level={c.risk_level} size="sm" />
            </button>
          ))}
          {critical.length===0 && watch.slice(0,8).map((c:any)=>(
            <button key={c.id} onClick={()=>onSelectCustomer(c.id)} className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3">
              <HealthRing score={c.health_score} size={44} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-slate-500 truncate">{c.segment} · {c.csm_name} · Health {Math.round(c.health_score)}</div>
              </div>
              <RiskBadge level={c.risk_level} size="sm" />
            </button>
          ))}
          {critical.length===0 && watch.length===0 && <div className="p-6 text-xs text-slate-500 text-center">All clear — no watch/critical. See <b>Analytics</b> for health histogram.</div>}
        </div>
      </Card>

      {customers.length===0 && (
        <EmptyState title="No customers yet" description="Import CSV or add manually to see portfolio, KPIs, and risk distribution. Go to Onboarding → Import or Customers → Import." action={<button onClick={load} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm">Refresh</button>} />
      )}
    </div>
  );
};
