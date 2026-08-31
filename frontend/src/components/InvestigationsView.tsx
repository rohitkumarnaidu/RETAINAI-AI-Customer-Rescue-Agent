import React, {useState, useEffect} from 'react';
import { getCustomers, getAgentRuns, getAgentRunDetail, getDatasets } from '../services/api';
import { Card, ErrorState, EmptyState, SkeletonCard } from './ui';
import { SearchCode, ArrowUpRight, Clock, AlertTriangle } from 'lucide-react';

export const InvestigationsView: React.FC<{onSelectCustomer:(id:string)=>void}> = ({onSelectCustomer})=>{
  const [runs,setRuns]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [selectedRun,setSelectedRun]=useState<any>(null);
  const [detail,setDetail]=useState<any>(null);
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [availableDatasets, setAvailableDatasets] = useState<{canonical:any[];generic:any[]}>({canonical:[],generic:[]});
  useEffect(()=>{ getDatasets().then(ds=> setAvailableDatasets({canonical: ds.canonical||[], generic: ds.generic||[]})).catch(()=>{}); },[]);

  const load=async()=>{
    try{
      setLoading(true);
      const cs=await getCustomers();
      const all: any[]=[];
      const slice = cs.slice(0,20);
      const chunkSize = 5;
      for(let i=0;i<slice.length;i+=chunkSize){
        const chunk = slice.slice(i, i+chunkSize);
        const results = await Promise.allSettled(chunk.map(async c=>{ try{ const r=await getAgentRuns(c.id); return r.map((x:any)=>({...x, customer_name:c.name})); }catch{ return []; }}));
        for(const res of results){ if(res.status==='fulfilled') all.push(...(res.value as any[])); }
      }
      all.sort((a,b)=> new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      setRuns(all);
    }catch(e:any){setError(e.message)} finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);

  const openRun=async(r:any)=>{
    setSelectedRun(r);
    try{ const d=await getAgentRunDetail(r.id); setDetail(d); } catch{ setDetail(null); }
  };

  if(loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load}/>;

  const filteredRuns = runs.filter((r:any)=>{
    if(datasetFilter==='all') return true;
    const txt = `${r.output_summary||''} ${r.input_summary||''} ${r.customer_name||''}`.toLowerCase();
    // generic dataset name
    if(availableDatasets.generic.some((g:any)=> g.dataset_name===datasetFilter)) return txt.includes(datasetFilter.toLowerCase());
    if(datasetFilter==='customers' || datasetFilter==='customers_db') return true;
    if(datasetFilter==='usage' || datasetFilter==='usage_events') return txt.includes('usage') || txt.includes('dau') || txt.includes('active') || txt.includes('decline');
    if(datasetFilter==='support' || datasetFilter==='support_tickets') return txt.includes('ticket') || txt.includes('support') || txt.includes('bug') || txt.includes('critical');
    if(datasetFilter==='feedback' || datasetFilter==='customer_feedbacks') return txt.includes('feedback') || txt.includes('sentiment') || txt.includes('csat') || txt.includes('nps');
    return txt.includes(datasetFilter.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold flex items-center gap-2"><SearchCode className="w-5 h-5"/> Investigations</h2>
        <p className="text-sm text-slate-600 mt-1">Agent runs — evidence gathering, root-cause synthesis, confidence. Click a run to view state history and tool calls.</p>
        <p className="text-xs text-slate-500 mt-1">Most recent {runs.length} runs across top 20 accounts · Real backend data (AgentRun + AgentStep) · Filter by any dataset below</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
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
          <span className="text-xs text-slate-500 self-center ml-1">{filteredRuns.length} of {runs.length} · {datasetFilter==='all' ? 'all datasets' : datasetFilter}</span>
        </div>
      </Card>

      {filteredRuns.length===0 ? <EmptyState title="No investigations yet" description={runs.length===0 ? "Run an investigation from Customer 360 to generate an agent trace." : `No ${datasetFilter} investigations — try All.`} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[320px]">
            <div className="p-3 border-b border-slate-200 text-xs font-mono text-slate-500 shrink-0">{filteredRuns.length} runs · {datasetFilter==='all' ? 'all 4 datasets' : datasetFilter}</div>
            <div className="divide-y divide-slate-100 flex-1 overflow-auto max-h-[640px] scrollbar-thin">
              {filteredRuns.map((r:any)=>(
                <button key={r.id} onClick={()=>openRun(r)} className={`w-full text-left p-3 hover:bg-slate-50 min-w-0 ${selectedRun?.id===r.id ? 'bg-slate-50 border-l-2 border-l-slate-900':''}`}>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="font-mono text-xs font-medium truncate min-w-0 flex-1" title={r.id}>{r.id}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${r.status==='COMPLETED'?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-amber-50 border-amber-200 text-amber-700'}`}>{r.status}</span>
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5 leading-tight" title={r.customer_name}>{r.customer_name}</div>
                  <div className="text-xs text-slate-500 truncate leading-tight" title={r.output_summary||r.input_summary}>{r.output_summary||r.input_summary||'—'}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 leading-none"><Clock className="w-3 h-3 shrink-0"/>{new Date(r.started_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-3">
            {!selectedRun ? <Card><div className="text-sm text-slate-500">Select a run to inspect.</div></Card> : (
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold font-mono">{selectedRun.id}</div>
                    <div className="text-xs text-slate-500">{selectedRun.customer_name} · {selectedRun.workflow_type||'CUSTOMER_RESCUE_INVESTIGATION'}</div>
                  </div>
                  <button onClick={()=>onSelectCustomer(selectedRun.customer_id)} className="text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1">Open 360 <ArrowUpRight className="w-3 h-3"/></button>
                </div>
                {detail ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><div className="text-[11px] text-slate-500">State</div><div className="font-medium truncate" title={detail.current_state}>{detail.current_state}</div></div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><div className="text-[11px] text-slate-500">Steps</div><div className="font-medium">{detail.total_steps}</div></div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5"><div className="text-[11px] text-slate-500">Model</div><div className="font-medium truncate" title={`${detail.model} ${detail.model_version}`}>{detail.model} {detail.model_version}</div></div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold">State history</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(detail.state_history||[]).map((h:any,i:number)=>(
                          <span key={i} className="text-[11px] border border-slate-200 bg-white px-2 py-1 rounded-full font-mono">{h.from} → {h.to}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Tool calls & steps</div>
                      <div className="mt-1 space-y-1 max-h-64 overflow-auto pr-1">
                        {(detail.steps||detail.tool_calls||[]).map((s:any,i:number)=>(
                          <div key={i} className="border border-slate-200 rounded-lg p-2.5 text-xs flex items-center justify-between gap-2 bg-white">
                            <span className="font-mono">{s.tool_name || s.state || s.tool || 'step'}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${s.status==='SUCCESS'?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-red-50 border-red-200 text-red-700'}`}>{s.status||'—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {detail.final_decision && (
                      <div>
                        <div className="text-xs font-semibold">Final decision (structured output)</div>
                        <pre className="mt-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 overflow-auto max-h-48">{(()=>{ const v=detail.final_decision; if(typeof v==='string'){ try{ return JSON.stringify(JSON.parse(v),null,2);}catch{ return v; } } return JSON.stringify(v,null,2); })()}</pre>
                      </div>
                    )}
                    {detail.error && <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/>{detail.error}</div>}
                  </div>
                ) : <div className="mt-4 text-sm text-slate-500">Loading detail…</div>}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
