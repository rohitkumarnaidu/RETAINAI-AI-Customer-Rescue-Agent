import React, {useEffect, useState} from 'react';
import { getPortfolio, getAllInterventions, getAllOutcomes, getObservability, getExperienceMemories, getDatasets } from '../services/api';
import { Card, ErrorState, SkeletonCard } from './ui';
import { ScrollText, Activity, Database, Cpu } from 'lucide-react';

export const AuditView: React.FC = ()=>{
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [availableDatasets, setAvailableDatasets] = useState<{canonical:any[];generic:any[]}>({canonical:[],generic:[]});
  useEffect(()=>{ getDatasets().then(ds=> setAvailableDatasets({canonical: ds.canonical||[], generic: ds.generic||[]})).catch(()=>{}); },[]);

  const load=async()=>{
    try{
      setLoading(true);
      const [portfolio, inters, outcomes, obs, mems]=await Promise.all([
        getPortfolio().catch(()=>null),
        getAllInterventions().catch(()=>[]),
        getAllOutcomes().catch(()=>[]),
        getObservability().catch(()=>null),
        getExperienceMemories().catch(()=>[]),
      ]);
      setData({portfolio, inters, outcomes, obs, mems});
    }catch(e:any){setError(e.message)} finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);

  if(loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1,2].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load}/>;

  const eventsAll = [
    ...(data.inters||[]).slice(0,8).map((i:any)=>({ts:i.created_at, type:'INTERVENTION', title:`${i.status} · ${i.title}`, id:i.id, dataset: (i.action_type||'').toLowerCase().includes('usage') ? 'usage' : (i.action_type||'').toLowerCase().includes('support') ? 'support' : (i.action_type||'').toLowerCase().includes('feedback') ? 'feedback' : 'customers'})),
    ...(data.outcomes||[]).slice(0,8).map((o:any)=>({ts:o.created_at, type:'OUTCOME', title:`${o.status} · Δ ${o.health_delta}`, id:o.id, dataset: 'customers'})),
  ].sort((a,b)=> new Date(b.ts).getTime()-new Date(a.ts).getTime()).slice(0,12);
  const events = datasetFilter==='all' ? eventsAll : eventsAll.filter((e:any)=> e.dataset===datasetFilter || (datasetFilter==='customers' && e.type==='OUTCOME'));

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold flex items-center gap-2"><ScrollText className="w-5 h-5"/> Activity & Audit</h2>
        <p className="text-sm text-slate-600 mt-1">System activity — risk changes, investigations, interventions, outcomes, learning. Auditable and timestamped.</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-2"><Database className="w-4 h-4"/> Portfolio snapshot</h3>
          <div className="mt-2 text-sm space-y-1">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Customers</span><span className="font-mono font-medium">{data.portfolio?.metrics?.total_customers ?? '—'}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">ARR at risk</span><span className="font-mono">${(data.portfolio?.metrics?.arr_at_risk||0).toLocaleString()}</span></div>
            <div className="text-xs text-slate-500 mt-2">Distribution: {Object.entries(data.portfolio?.metrics?.risk_distribution||{}).map(([k,v])=>`${k} ${v}`).join(' · ') || '—'}</div>
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4"/> Interventions & outcomes</h3>
          <div className="mt-2 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Interventions</span><span className="font-mono">{data.inters?.length||0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Outcomes</span><span className="font-mono">{data.outcomes?.length||0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Memories</span><span className="font-mono">{data.mems?.length||0}</span></div>
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-2"><Cpu className="w-4 h-4"/> Observability</h3>
          {data.obs ? (
            <div className="mt-2 text-xs space-y-1 font-mono">
              <div className="flex justify-between"><span className="text-slate-500">Agent runs</span><span>{data.obs.agent_runs?.completed}/{data.obs.agent_runs?.total} ({(data.obs.agent_runs?.completion_rate*100).toFixed(0)}%)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Outcomes success</span><span>{data.obs.outcomes?.success_rate ? (data.obs.outcomes.success_rate*100).toFixed(0)+'%':'—'}</span></div>
              <div className="text-[11px] text-slate-400 mt-1">Request {data.obs.request_id}</div>
            </div>
          ) : <div className="text-xs text-slate-500 mt-2">Observability metrics unavailable.</div>}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">Recent activity (chronological)</h3>
          <div className="flex flex-wrap gap-1">
            <button onClick={()=> setDatasetFilter('all')} className={`px-2 py-1 rounded-full text-[11px] font-mono border ${datasetFilter==='all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}>All {availableDatasets.canonical.length + availableDatasets.generic.length || 4}</button>
            {availableDatasets.canonical.map((d:any)=>(
              <button key={d.dataset_name} onClick={()=> setDatasetFilter(d.dataset_name)} className={`px-2 py-1 rounded-full text-[11px] font-mono border capitalize ${datasetFilter===d.dataset_name ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}>{d.display || d.dataset_name}</button>
            ))}
            {availableDatasets.generic.map((d:any)=>(
              <button key={d.dataset_name} onClick={()=> setDatasetFilter(d.dataset_name)} className={`px-2 py-1 rounded-full text-[11px] font-mono border ${datasetFilter===d.dataset_name ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{d.display || d.dataset_name}</button>
            ))}
            {availableDatasets.canonical.length===0 && availableDatasets.generic.length===0 && (['customers','usage','support','feedback'] as const).map(f=>(
              <button key={f} onClick={()=> setDatasetFilter(f)} className={`px-2 py-1 rounded-full text-[11px] font-mono border capitalize ${datasetFilter===f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-1">{events.length} of {eventsAll.length} · {datasetFilter==='all' ? 'all datasets' : datasetFilter}</div>
        <div className="mt-3 space-y-2 max-h-[520px] overflow-auto pr-1 scrollbar-thin">
          {events.length===0 ? <div className="text-xs text-slate-500">No activity yet — generate an investigation to populate the audit trail.</div> : events.map((e:any)=>(
            <div key={e.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 bg-white min-w-0">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-slate-500 leading-tight truncate" title={`${new Date(e.ts).toLocaleString()} · ${e.type}`}>{new Date(e.ts).toLocaleString()} · {e.type}</div>
                <div className="text-sm font-medium mt-0.5 leading-tight truncate" title={e.title}>{e.title}</div>
                <div className="text-xs font-mono text-slate-400 truncate leading-tight" title={e.id}>{e.id}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap shrink-0 leading-none ${e.type==='OUTCOME'?'bg-slate-900 text-white border-slate-900':'bg-white border-slate-200'}`}>{e.type}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
