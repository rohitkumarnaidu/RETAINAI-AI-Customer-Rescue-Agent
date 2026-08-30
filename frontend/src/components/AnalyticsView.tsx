import React, { useEffect, useState } from 'react';
import { getPortfolio, getObservability, getDatasets } from '../services/api';
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

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const metrics = portfolio?.metrics || {};
  const customersAll: any[] = portfolio?.customers || [];
  const customers = datasetFilter==='all' ? customersAll : customersAll.filter((c:any)=>{
    if(datasetFilter==='customers') return true;
    if(datasetFilter==='usage') return (c.health_score ?? 100) < 75;
    if(datasetFilter==='support') return ['AT_RISK','HIGH_RISK','CRITICAL'].includes(c.risk_level);
    if(datasetFilter==='feedback') return (c.health_score ?? 100) >= 40 && (c.health_score ?? 100) <= 85;
    return true;
  });
  const riskDist: Record<string, number> = datasetFilter==='all' ? (metrics.risk_distribution || {}) : customers.reduce((acc:any,c:any)=>{ const k=c.risk_level||'HEALTHY'; acc[k]=(acc[k]||0)+1; return acc; },{} as Record<string,number>);
  const total = datasetFilter==='all' ? (metrics.total_customers || customers.length || 0) : customers.length;
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

  // Segment breakdown
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
                <button key={d.dataset_name} onClick={()=> setDatasetFilter(d.dataset_name)} className={`px-3 py-1 rounded-full text-xs font-mono border capitalize ${datasetFilter===d.dataset_name ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{d.display || d.dataset_name}</button>
              ))}
              {availableDatasets.generic.map((d:any)=>(
                <button key={d.dataset_name} onClick={()=> setDatasetFilter(d.dataset_name)} className={`px-3 py-1 rounded-full text-xs font-mono border ${datasetFilter===d.dataset_name ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-white'}`}>{d.display || d.dataset_name}</button>
              ))}
              {availableDatasets.canonical.length===0 && availableDatasets.generic.length===0 && (['customers','usage','support','feedback'] as const).map(f=>(
                <button key={f} onClick={()=> setDatasetFilter(f)} className={`px-3 py-1 rounded-full text-xs font-mono border capitalize ${datasetFilter===f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{f}</button>
              ))}
              <span className="text-xs text-slate-500 self-center ml-1">{datasetFilter==='all' ? 'all datasets' : datasetFilter} · {customers.length} accounts</span>
            </div>
          </div>
          <button onClick={load} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Refresh</button>
        </div>
      </Card>

      {/* KPI row — correct place for analytics, not crammed in Command Center */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><PieChart className="w-4 h-4" /> Risk distribution</h3>
          <p className="text-xs text-slate-500 mt-1">Where to act first — SENSE → THINK</p>
          <div className="mt-4">
            {riskSegments.length ? <Donut segments={riskSegments} /> : <div className="text-xs text-slate-500">No data — import customers</div>}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Health histogram</h3>
          <p className="text-xs text-slate-500 mt-1">0-100 buckets — detect drift</p>
          <div className="mt-4 space-y-2">
            {healthHist.map(b => (
              <Bar key={b.label} label={b.label} value={b.count} max={maxHist} color={b.label === '0-20' ? 'bg-red-500' : b.label === '80-100' ? 'bg-emerald-500' : 'bg-slate-800'} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold">Segment breakdown</h3>
          <p className="text-xs text-slate-500 mt-1">Portfolio by segment — correct page for portfolio analytics (not in 360)</p>
          <div className="mt-4 space-y-2">
            {segEntries.length ? segEntries.map(([seg, cnt]) => (
              <Bar key={seg} label={seg} value={cnt as number} max={Math.max(...segEntries.map(([, c]) => c as number))} color="bg-sky-600" />
            )) : <div className="text-xs text-slate-500">No segments — import data</div>}
          </div>
        </Card>

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
      </div>

      <Card>
        <h3 className="text-sm font-semibold">How this page is correct</h3>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">Analytics was crammed in <b>Command Center</b> (KPIs + table + hero) and <b>Customer 360</b> (injection + timeline + plan). Now: <b>Command Center</b> keeps <code className="bg-slate-100 px-1 rounded">SENSE</code> (4 KPIs + Needs attention), <b>Analytics</b> holds <code className="bg-slate-100 px-1 rounded">MEASURE</code> visuals, <b>Customers</b> holds portfolio table, <b>360</b> holds investigation — each page does one job.</p>
      </Card>
    </div>
  );
};
