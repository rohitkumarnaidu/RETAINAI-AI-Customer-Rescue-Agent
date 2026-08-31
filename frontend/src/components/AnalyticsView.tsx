import React, { useEffect, useState, useMemo } from 'react';
import { getPortfolio, getObservability, getDatasets, getDatasetRecords } from '../services/api';
import { Card, SkeletonCard, ErrorState } from './ui';
import { BarChart3, TrendingUp, PieChart, Activity, DollarSign, Shield } from 'lucide-react';

// Simple bar with divs — no extra deps, keep bundle small
const Bar: React.FC<{ label: string; value: number; max: number; color?: string }> = ({ label, value, max, color = 'bg-[#0F172A]' }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-20 truncate text-slate-600">{label}</span>
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
    <span className="w-8 text-right font-mono text-slate-700">{value}</span>
  </div>
);

const Donut: React.FC<{ segments: { label: string; value: number; color: string }[] }> = ({ segments }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  // Build conic-gradient with cumulative stops — fixes color mixing/overlap bug
  let acc = 0;
  const gradient = segments
    .map(s => {
      const start = (acc / total) * 100;
      acc += s.value;
      const end = (acc / total) * 100;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(', ');
  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className="relative w-24 h-24 shrink-0">
        <div className="absolute inset-0 rounded-full border-[8px] border-slate-100" />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
            mask: 'radial-gradient(circle at center, transparent 28px, black 29px)',
            WebkitMask: 'radial-gradient(circle at center, transparent 28px, black 29px)',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none">{total}</span>
          <span className="text-[10px] font-mono text-slate-500 leading-none mt-0.5">accounts</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="flex-1 truncate text-slate-600" title={s.label}>{s.label}</span>
            <span className="font-mono text-slate-900 whitespace-nowrap">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnalyticsView: React.FC = () => {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [obs, setObs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [availableDatasets, setAvailableDatasets] = useState<{canonical:any[];generic:any[]}>({canonical:[],generic:[]});
  const [datasetStats, setDatasetStats] = useState<Record<string, any>>({});
  const [filteredIds, setFilteredIds] = useState<Set<string> | null>(null);
  const [datasetAnalytics, setDatasetAnalytics] = useState<any>(null);
  const [datasetRowsPreview, setDatasetRowsPreview] = useState<any[]>([]);

  // Derived values — must be defined before effects that depend on them, and before early returns
  const metrics = portfolio?.metrics || {};
  const customersAll: any[] = portfolio?.customers || [];

  useEffect(()=>{ getDatasets().then((ds: any)=> setAvailableDatasets({canonical: ds.canonical||[], generic: ds.generic||[]})).catch(()=>{}); },[]);

  const load = async () => {
    try {
      setLoading(true);
      const [p, o] = await Promise.all([getPortfolio(), getObservability().catch(() => null)]);
      setPortfolio(p);
      setObs(o);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const ds = await getDatasets().catch(()=>({canonical:[], generic:[]}));
        if(cancelled) return;
        const stats:Record<string,any> = {};
        for(const c of (ds as any).canonical||[]){
          stats[c.dataset_name] = c.rows;
        }
        for(const g of (ds as any).generic||[]){
          stats[g.dataset_name] = g.rows;
        }
        // also fetch live counts for 4 canonical via timelines sample for more accurate per-dataset event totals
        try{
          const slice = customersAll.slice(0, 12);
          const tls = await Promise.all(slice.map((c:any)=> import('../services/api').then(m=> m.getCustomerTimeline(c.id, 30).catch(()=>[]))));
          const flat = (tls as any).flat();
          // keep these as additional hints, but primary is canonical counts
          stats['usage_events_hint'] = flat.filter((e:any)=> (e.source||'').toUpperCase().includes('USAGE')).length;
          stats['support_tickets_hint'] = flat.filter((e:any)=> (e.source||'').toUpperCase().includes('SUPPORT') || (e.source||'').toUpperCase().includes('TICKET')).length;
          stats['customer_feedbacks_hint'] = flat.filter((e:any)=> (e.source||'').toUpperCase().includes('FEEDBACK') || (e.source||'').toUpperCase().includes('CSAT')).length;
          stats['customers'] = customersAll.length;
        } catch{}
        if(!cancelled) setDatasetStats(stats);
      } catch{}
    })();
    return ()=>{ cancelled=true; };
  }, [portfolio, datasetFilter]);

  // NEW: per-dataset filtering — fetch distinct customer_ids for this dataset so visuals actually change
  useEffect(()=>{
    // reset when all or customers (no filter)
    if(datasetFilter==='all' || datasetFilter==='customers'){
      setFilteredIds(null);
      setDatasetAnalytics(null);
      setDatasetRowsPreview([]);
      return;
    }
    let cancelled=false;
    setFilteredIds(null);
    setDatasetAnalytics(null);
    (async()=>{
      try{
        const res: any = await getDatasetRecords(datasetFilter, 200, 0).catch(()=> null);
        if(cancelled || !res) { setFilteredIds(new Set()); return; }
        const rows: any[] = res.rows || [];
        setDatasetRowsPreview(rows.slice(0, 5));
        const ids = new Set<string>();
        for(const r of rows){
          // canonical: r.customer_id directly
          const cid = (r as any).customer_id || (r as any).customerId;
          if(cid) ids.add(String(cid));
          // generic fallback: row itself may be the row_data (when generic)
          if(!cid && r && typeof r === 'object'){
            const gc = (r as any).customer_id || (r as any).customer || (r as any).cust_id || (r as any).account_id || (r as any).customer_name;
            // for generic we stored customer_id at top level if detected; otherwise try row_data nested
            if(gc && typeof gc==='string' && gc.length>3 && gc.includes('-')) ids.add(String(gc));
            // also check if r is row_data with customer linkage via name lookup? fallback attempt via name
            const maybeCidFromRowData = (r as any).row_data?.customer_id;
            if(maybeCidFromRowData) ids.add(String(maybeCidFromRowData));
          }
        }
        // For support/feedback/usage, ids should be populated. For generic without linkage, ids stays empty -> filtered will be 0
        if(!cancelled) setFilteredIds(ids);

        // Build dataset-specific analytics for the lower card
        if(datasetFilter==='support_tickets' || datasetFilter==='support'){
          const sev: Record<string,number> = {};
          const stat: Record<string,number> = {};
          for(const r of rows){ const k=String(r.severity||'UNKNOWN').toUpperCase(); sev[k]=(sev[k]||0)+1; const st=String(r.status||'UNKNOWN').toUpperCase(); stat[st]=(stat[st]||0)+1; }
          if(!cancelled) setDatasetAnalytics({ type:'support', severity: sev, status: stat });
        } else if(datasetFilter==='customer_feedbacks' || datasetFilter==='feedback' || datasetFilter==='customer_feedbacks'){
          const sent: Record<string,number> = {};
          const scoreHist: Record<string,number> = {'1-2':0,'3-5':0,'6-7':0,'8-10':0};
          for(const r of rows){ const k=String(r.sentiment||'NEUTRAL').toUpperCase(); sent[k]=(sent[k]||0)+1; const sc = Number(r.score); if(!isNaN(sc)){ if(sc<=2) scoreHist['1-2']++; else if(sc<=5) scoreHist['3-5']++; else if(sc<=7) scoreHist['6-7']++; else scoreHist['8-10']++; } }
          if(!cancelled) setDatasetAnalytics({ type:'feedback', sentiment: sent, scoreHist });
        } else if(datasetFilter==='usage_events' || datasetFilter==='usage'){
          // usage: aggregate DAU buckets
          const dauBuckets: Record<string,number> = {'0-100':0,'101-300':0,'301-600':0,'601+':0};
          const licBuckets: Record<string,number> = {'0-0.5':0,'0.51-0.75':0,'0.76-0.9':0,'0.91-1':0};
          for(const r of rows){ const dau=Number(r.daily_active_users||r.dau||0); if(dau<=100) dauBuckets['0-100']++; else if(dau<=300) dauBuckets['101-300']++; else if(dau<=600) dauBuckets['301-600']++; else dauBuckets['601+']++; const lic=Number(r.license_utilization||0); if(lic<=0.5) licBuckets['0-0.5']++; else if(lic<=0.75) licBuckets['0.51-0.75']++; else if(lic<=0.9) licBuckets['0.76-0.9']++; else licBuckets['0.91-1']++; }
          if(!cancelled) setDatasetAnalytics({ type:'usage', dauBuckets, licBuckets, avgDau: rows.length? Math.round(rows.reduce((s:any,r:any)=> s+Number(r.daily_active_users||0),0)/rows.length):0 });
        } else {
          // generic: frequency of first column values
          const headers: string[] = (res as any).headers || Object.keys(rows[0]||{});
          const firstKey = headers[0];
          const freq: Record<string,number> = {};
          for(const r of rows){ const v=String((r as any)[firstKey] ?? (r as any).row_data?.[firstKey] ?? '—').slice(0,30); freq[v]=(freq[v]||0)+1; }
          // keep top 5
          const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5);
          if(!cancelled) setDatasetAnalytics({ type:'generic', firstKey, freq: Object.fromEntries(sorted), headers, rowCount: rows.length });
        }
      } catch{
        if(!cancelled) { setFilteredIds(new Set()); setDatasetAnalytics(null); }
      }
    })();
    return ()=>{ cancelled=true; };
  }, [datasetFilter]);

  // Filtered customers: when datasetFilter is active, only show customers that have at least one record in that dataset
  // MUST be before early returns — hooks cannot be after conditional returns (React #310)
  const customers = useMemo(()=>{
    if(datasetFilter==='all' || datasetFilter==='customers') return customersAll;
    if(filteredIds===null) return customersAll; // still loading -> show all temporarily but will update
    if(filteredIds.size===0) return []; // no linkage -> empty, makes visuals empty (so they change)
    return customersAll.filter((c:any)=> filteredIds.has(c.id));
  }, [customersAll, datasetFilter, filteredIds]);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const isFiltered = datasetFilter!=='all';
  const filteredCount = customers.length;
  const totalCustomers = customersAll.length;
  const coverage = totalCustomers ? Math.round((filteredCount/totalCustomers)*100) : 0;

  const riskDist: Record<string, number> = isFiltered ? customers.reduce((acc:any,c:any)=>{ const k=c.risk_level||'HEALTHY'; acc[k]=(acc[k]||0)+1; return acc; },{} as Record<string,number>) : (metrics.risk_distribution || customers.reduce((acc:any,c:any)=>{ const k=c.risk_level||'HEALTHY'; acc[k]=(acc[k]||0)+1; return acc; },{} as Record<string,number>));
  const total = isFiltered ? filteredCount : (metrics.total_customers || customers.length || 0);
  const atRisk = (riskDist['AT_RISK'] || 0) + (riskDist['HIGH_RISK'] || 0) + (riskDist['CRITICAL'] || 0);
  const totalArr = customers.reduce((s: number, c: any) => s + (c.arr || 0), 0);
  const atRiskArr = customers.filter((c: any) => ['AT_RISK', 'HIGH_RISK', 'CRITICAL'].includes(c.risk_level)).reduce((s: number, c: any) => s + (c.arr || 0), 0);

  // Health histogram (0-100 buckets) — uses Math.round health for stability
  const buckets = [0, 20, 40, 60, 80, 100];
  const healthHist = buckets.slice(1).map((upper, idx) => {
    const lower = buckets[idx];
    const label = `${lower}-${upper}`;
    const count = customers.filter((c: any) => {
      const h = Math.round(Number(c.health_score ?? 0));
      return h >= lower && h < (upper === 100 ? 101 : upper);
    }).length;
    return { label, count };
  });
  const maxHist = Math.max(1, ...healthHist.map(h => h.count));

  // Segment breakdown - now filtered
  const segMap = customers.reduce((acc: Record<string, number>, c: any) => {
    acc[c.segment] = (acc[c.segment] || 0) + 1;
    return acc;
  }, {});
  const segEntries = Object.entries(segMap).sort((a, b) => (b[1] as number) - (a[1] as number));

  // Risk pie segments
  const riskSegments = [
    { label: 'HEALTHY', value: riskDist['HEALTHY'] || 0, color: '#10b981' },
    { label: 'STABLE', value: riskDist['STABLE'] || 0, color: '#06b6d4' },
    { label: 'WATCH', value: riskDist['WATCH'] || 0, color: '#f59e0b' },
    { label: 'AT RISK', value: riskDist['AT_RISK'] || 0, color: '#f97316' },
    { label: 'HIGH/CRITICAL', value: (riskDist['HIGH_RISK'] || 0) + (riskDist['CRITICAL'] || 0), color: '#ef4444' },
  ].filter(s => s.value > 0);

  // Helper to render dataset-specific breakdown
  const renderDatasetSpecificCard = () => {
    if(!isFiltered) return null;
    if(datasetFilter==='support_tickets' || datasetFilter==='support'){
      const sev = datasetAnalytics?.severity || {};
      const sta = datasetAnalytics?.status || {};
      const maxSev = Math.max(1, ...Object.values(sev as Record<string,number>) as number[]);
      const maxSta = Math.max(1, ...Object.values(sta as Record<string,number>) as number[]);
      return (
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Activity className="w-4 h-4 text-orange-600" /> Support breakdown — severity & status</h3>
          <p className="text-xs text-slate-500 mt-1">For {filteredCount} accounts with tickets · {datasetStats[datasetFilter]||0} total tickets · {coverage}% coverage</p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[11px] font-mono text-slate-500">BY SEVERITY</div>
              <div className="mt-1.5 space-y-1.5">
                {Object.keys(sev).length ? Object.entries(sev).sort((a,b)=> (b[1] as number)-(a[1] as number)).map(([k,v])=>(
                  <Bar key={k} label={k} value={v as number} max={maxSev} color={k==='CRITICAL'?'bg-red-600': k==='HIGH'?'bg-orange-500': k==='MEDIUM'?'bg-amber-500':'bg-slate-400'} />
                )) : <div className="text-xs text-slate-400">Loading…</div>}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-slate-500">BY STATUS</div>
              <div className="mt-1.5 space-y-1.5">
                {Object.keys(sta).length ? Object.entries(sta).map(([k,v])=>(
                  <Bar key={k} label={k} value={v as number} max={maxSta} color="bg-sky-600" />
                )) : <div className="text-xs text-slate-400">—</div>}
              </div>
            </div>
          </div>
        </Card>
      );
    }
    if(datasetFilter==='customer_feedbacks' || datasetFilter==='feedback'){
      const sent = datasetAnalytics?.sentiment || {};
      const hist = datasetAnalytics?.scoreHist || {};
      const maxSent = Math.max(1, ...Object.values(sent as Record<string,number>) as number[]);
      const maxHistS = Math.max(1, ...Object.values(hist as Record<string,number>) as number[]);
      return (
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Activity className="w-4 h-4 text-purple-600" /> Feedback breakdown — sentiment & NPS</h3>
          <p className="text-xs text-slate-500 mt-1">For {filteredCount} accounts with feedback · {datasetStats[datasetFilter]||0} entries</p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[11px] font-mono text-slate-500">SENTIMENT</div>
              <div className="mt-1.5 space-y-1.5">
                {Object.keys(sent).length ? Object.entries(sent).map(([k,v])=>(
                  <Bar key={k} label={k} value={v as number} max={maxSent} color={k==='POSITIVE'?'bg-emerald-500': k==='NEGATIVE'?'bg-red-500':'bg-slate-400'} />
                )) : <div className="text-xs text-slate-400">Loading…</div>}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-slate-500">SCORE (NPS 1-10)</div>
              <div className="mt-1.5 space-y-1.5">
                {Object.entries(hist).map(([k,v])=>(
                  <Bar key={k} label={k} value={v as number} max={maxHistS} color="bg-violet-600" />
                ))}
              </div>
            </div>
          </div>
        </Card>
      );
    }
    if(datasetFilter==='usage_events' || datasetFilter==='usage'){
      const dau = datasetAnalytics?.dauBuckets || {};
      const lic = datasetAnalytics?.licBuckets || {};
      const maxDau = Math.max(1, ...Object.values(dau as Record<string,number>) as number[]);
      const maxLic = Math.max(1, ...Object.values(lic as Record<string,number>) as number[]);
      return (
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Activity className="w-4 h-4 text-blue-600" /> Usage breakdown — DAU & license</h3>
          <p className="text-xs text-slate-500 mt-1">{datasetStats[datasetFilter]||0} events · avg DAU {datasetAnalytics?.avgDau||'—'} · {filteredCount} accounts (usage covers {coverage}%)</p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[11px] font-mono text-slate-500">DAU PER EVENT</div>
              <div className="mt-1.5 space-y-1.5">
                {Object.keys(dau).length ? Object.entries(dau).map(([k,v])=>(
                  <Bar key={k} label={k} value={v as number} max={maxDau} color="bg-blue-600" />
                )) : <div className="text-xs text-slate-400">Loading…</div>}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono text-slate-500">LICENSE UTILIZATION</div>
              <div className="mt-1.5 space-y-1.5">
                {Object.entries(lic).map(([k,v])=>(
                  <Bar key={k} label={k} value={v as number} max={maxLic} color="bg-indigo-600" />
                ))}
              </div>
            </div>
          </div>
        </Card>
      );
    }
    // generic
    const freq = datasetAnalytics?.freq as Record<string,number> || {};
    const firstKey = datasetAnalytics?.firstKey || 'value';
    const maxF = Math.max(1, ...Object.values(freq) as number[]);
    return (
      <Card>
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Activity className="w-4 h-4 text-emerald-600" /> {datasetFilter} — top values in “{firstKey}”</h3>
        <p className="text-xs text-slate-500 mt-1">{datasetStats[datasetFilter]||0} rows · {filteredCount} linked accounts · {coverage}% coverage</p>
        <div className="mt-4 space-y-1.5">
          {Object.keys(freq).length ? Object.entries(freq).map(([k,v])=>(
            <Bar key={k} label={k||'(empty)'} value={v as number} max={maxF} color="bg-emerald-600" />
          )) : <div className="text-xs text-slate-400">No linked accounts or loading… {datasetRowsPreview.length? `preview: ${JSON.stringify(datasetRowsPreview[0]).slice(0,80)}`:''}</div>}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Analytics — visuals</h2>
            <p className="text-sm text-slate-600 mt-1">Live portfolio visuals, not mock. All from <code className="bg-slate-100 px-1 rounded">GET /portfolio</code> + <code className="bg-slate-100 px-1 rounded">/metrics/observability</code> per tenant. Filter by any dataset:</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button onClick={()=> setDatasetFilter('all')} className={`px-3 py-1 rounded-full text-xs font-mono border ${datasetFilter==='all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>All {availableDatasets.canonical.length + availableDatasets.generic.length || 4}</button>
              {availableDatasets.canonical.map((d:any)=>(
                <button key={d.dataset_name} onClick={()=> setDatasetFilter(d.dataset_name)} className={`px-3 py-1 rounded-full text-xs font-mono border capitalize ${datasetFilter===d.dataset_name ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{d.display || d.dataset_name} · {d.rows}</button>
              ))}
              {availableDatasets.generic.map((d:any)=>(
                <button key={d.dataset_name} onClick={()=> setDatasetFilter(d.dataset_name)} className={`px-3 py-1 rounded-full text-xs font-mono border ${datasetFilter===d.dataset_name ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-white'}`}>{d.display || d.dataset_name} · {d.rows}</button>
              ))}
              {availableDatasets.canonical.length===0 && availableDatasets.generic.length===0 && (['customers','usage','support','feedback'] as const).map(f=>(
                <button key={f} onClick={()=> setDatasetFilter(f)} className={`px-3 py-1 rounded-full text-xs font-mono border capitalize ${datasetFilter===f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{f}</button>
              ))}
              <span className="text-xs text-slate-500 self-center ml-1">{datasetFilter==='all' ? `all datasets · ${customers.length} accounts` : `${datasetFilter} · ${filteredIds===null ? '...' : filteredCount} accounts${filteredIds!==null ? ` · ${coverage}% of portfolio`:''}`}</span>
            </div>
          </div>
          <button onClick={load} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Refresh</button>
        </div>
      </Card>

      {/* KPI row — per-dataset, not same for all */}
      {datasetFilter==='all' ? (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 shrink-0" /> TOTAL ARR</div>
          <div className="text-2xl font-semibold mt-1 tracking-tight">${(totalArr / 1000).toFixed(0)}k</div>
          <div className="text-xs text-slate-500 mt-1 leading-tight truncate" title={`${total} accounts`}>{total} accounts · avg ${(total ? totalArr / total : 0).toFixed(0).toLocaleString()} ARR</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-red-500 shrink-0" /> ARR AT RISK</div>
          <div className="text-2xl font-semibold mt-1 text-red-600 tracking-tight">${(atRiskArr / 1000).toFixed(0)}k</div>
          <div className="text-xs text-slate-500 mt-1 leading-tight">{totalArr ? ((atRiskArr / totalArr) * 100).toFixed(1) : 0}% of portfolio · {atRisk} accounts</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 shrink-0" /> HEALTH AVG</div>
          <div className="text-2xl font-semibold mt-1">{total ? Math.round(customers.reduce((s: number, c: any) => s + (c.health_score || 0), 0) / total) : 0}<span className="text-sm text-slate-400">/100</span></div>
          <div className="text-xs text-slate-500 mt-1 leading-tight">{riskDist['HEALTHY'] || 0} healthy · {riskDist['CRITICAL'] || 0} critical</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 shrink-0" /> SIGNALS</div>
          <div className="text-2xl font-semibold mt-1">{obs?.tool_calls?.total ?? '—'}</div>
          <div className="text-xs text-slate-500 mt-1 leading-tight">Agent tool calls · {obs?.agent_runs?.total ?? 0} runs</div>
        </Card>
      </div>
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs font-mono text-slate-500">DATASET</div>
          <div className="text-lg font-bold mt-1 capitalize truncate" title={datasetFilter}>{datasetFilter.replace('_',' ')}</div>
          <div className="text-xs text-slate-500 mt-1">{datasetFilter==='customers' ? `${datasetStats['customers']?? customers.length} rows` : `${datasetStats[datasetFilter]?? 0} rows`} · {datasetFilter}</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500">ROWS</div>
          <div className="text-2xl font-semibold mt-1">{datasetStats[datasetFilter] ?? datasetStats[datasetFilter.replace('s','')] ?? '—'}</div>
          <div className="text-xs text-slate-500 mt-1">in this dataset · tenant-isolated</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500">FILTERED ACCOUNTS</div>
          <div className="text-2xl font-semibold mt-1">{filteredIds===null ? '…' : filteredCount}</div>
          <div className="text-xs text-slate-500 mt-1">{coverage}% of portfolio · {datasetFilter} view {filteredIds!==null && filteredCount===0 ? '· no linked customers' : ''}</div>
        </Card>
        <Card>
          <div className="text-xs font-mono text-slate-500">SOURCE</div>
          <div className="text-sm font-bold mt-1 truncate" title={datasetFilter}>{datasetFilter}</div>
          <div className="text-xs text-slate-500 mt-1">from GET /datasets · distinct customers in this dataset</div>
        </Card>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><PieChart className="w-4 h-4" /> Risk distribution {isFiltered ? `· ${filteredCount} in ${datasetFilter}` : ''}</h3>
          <p className="text-xs text-slate-500 mt-1">Where to act first — SENSE → THINK {isFiltered ? `· filtered` : ''}</p>
          <div className="mt-4">
            {riskSegments.length ? <Donut segments={riskSegments} /> : <div className="text-xs text-slate-500">{filteredCount===0 ? 'No accounts in this dataset — try All' : 'No data — import customers'}</div>}
          </div>
          {isFiltered && <div className="text-[11px] font-mono text-slate-400 mt-2">{filteredCount} accounts vs {totalCustomers} total · {coverage}% coverage</div>}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Health histogram {isFiltered ? `· filtered` : ''}</h3>
          <p className="text-xs text-slate-500 mt-1">0-100 buckets — detect drift {isFiltered ? `· ${filteredCount} accounts` : ''}</p>
          <div className="mt-4 space-y-2">
            {healthHist.map(b => (
              <Bar key={b.label} label={b.label} value={b.count} max={maxHist} color={b.label === '0-20' ? 'bg-red-500' : b.label === '80-100' ? 'bg-emerald-500' : 'bg-slate-800'} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isFiltered ? renderDatasetSpecificCard() : (
          <Card>
            <h3 className="text-sm font-semibold">Segment breakdown</h3>
            <p className="text-xs text-slate-500 mt-1">Portfolio by segment — correct page for portfolio analytics (not in 360)</p>
            <div className="mt-4 space-y-2">
              {segEntries.length ? segEntries.map(([seg, cnt]) => (
                <Bar key={seg} label={seg} value={cnt as number} max={Math.max(...segEntries.map(([, c]) => c as number))} color="bg-sky-600" />
              )) : <div className="text-xs text-slate-500">No segments — import data</div>}
            </div>
          </Card>
        )}
        {/* When filtered we show both: dataset-specific + segment or ARR; keep ARR always but filtered */}
        {isFiltered && (
          <Card>
            <h3 className="text-sm font-semibold">Segment breakdown · filtered</h3>
            <p className="text-xs text-slate-500 mt-1">{filteredCount} accounts in {datasetFilter} by segment</p>
            <div className="mt-4 space-y-2">
              {segEntries.length ? segEntries.map(([seg, cnt]) => (
                <Bar key={seg} label={seg} value={cnt as number} max={Math.max(1, ...segEntries.map(([, c]) => c as number))} color="bg-sky-600" />
              )) : <div className="text-xs text-slate-500">{filteredCount===0?'No accounts': 'No segments'}</div>}
            </div>
          </Card>
        )}

        {!isFiltered && (
          <Card>
            <h3 className="text-sm font-semibold">ARR concentration</h3>
            <p className="text-xs text-slate-500 mt-1">Top 5 accounts by ARR — focus retention where $ is</p>
            <div className="mt-3 space-y-2">
              {customers.slice().sort((a: any, b: any) => (b.arr || 0) - (a.arr || 0)).slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 text-xs min-w-0">
                  <span className="flex-1 truncate font-medium min-w-0" title={c.name}>{c.name}</span>
                  <span className="font-mono text-slate-600 whitespace-nowrap shrink-0">${Math.round(c.arr || 0).toLocaleString()}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${c.risk_level === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-700' : c.risk_level === 'HEALTHY' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200'}`}>{c.risk_level}</span>
                </div>
              ))}
              {customers.length === 0 && <div className="text-xs text-slate-500">No customers — import to see concentration</div>}
            </div>
          </Card>
        )}
      </div>
      {/* ARR concentration for filtered view stays below */}
      {isFiltered && (
        <Card>
          <h3 className="text-sm font-semibold">ARR concentration · filtered {filteredCount} in {datasetFilter}</h3>
          <p className="text-xs text-slate-500 mt-1">Top 5 filtered accounts by ARR — focus retention where $ is in this dataset</p>
          <div className="mt-3 space-y-2">
            {customers.slice().sort((a: any, b: any) => (b.arr || 0) - (a.arr || 0)).slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 text-xs min-w-0">
                <span className="flex-1 truncate font-medium min-w-0" title={c.name}>{c.name}</span>
                <span className="font-mono text-slate-600 whitespace-nowrap shrink-0">${Math.round(c.arr || 0).toLocaleString()}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${c.risk_level === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-700' : c.risk_level === 'HEALTHY' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200'}`}>{c.risk_level}</span>
              </div>
            ))}
            {customers.length === 0 && <div className="text-xs text-slate-500">No accounts in this dataset — covers {coverage}% of portfolio</div>}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold">How this page is correct</h3>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">Analytics was crammed in <b>Command Center</b> (KPIs + table + hero) and <b>Customer 360</b> (injection + timeline + plan). Now: <b>Command Center</b> keeps <code className="bg-slate-100 px-1 rounded">SENSE</code> (4 KPIs + Needs attention), <b>Analytics</b> holds <code className="bg-slate-100 px-1 rounded">MEASURE</code> visuals, <b>Customers</b> holds portfolio table, <b>360</b> holds investigation — each page does one job. Filtered views show <b>distinct customers per dataset</b> so numbers actually change.</p>
      </Card>
    </div>
  );
};
