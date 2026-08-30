import React, {useEffect, useState} from 'react';
import { getAllInterventions, getAllOutcomes, approveIntervention, rejectIntervention } from '../services/api';
import { Card, ErrorState, EmptyState, SkeletonCard } from './ui';
import { ClipboardList, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';

export const InterventionsView: React.FC = ()=>{
  const [inters,setInters]=useState<any[]>([]);
  const [outcomes,setOutcomes]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [filter,setFilter]=useState<string>('ALL');

  const load=async()=>{
    try{
      setLoading(true);
      const [i,o]=await Promise.all([getAllInterventions(), getAllOutcomes()]);
      setInters(i); setOutcomes(o);
    } catch(e:any){ setError(e.message) } finally{ setLoading(false) }
  };
  useEffect(()=>{load()},[]);

  const filtered = filter==='ALL' ? inters : inters.filter((x:any)=> (x.status||'').toUpperCase()===filter);
  const outcomeByIntervention = new Map(outcomes.map((o:any)=>[o.intervention_id, o]));

  if(loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load}/>;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="w-5 h-5"/> Interventions</h2>
        <p className="text-sm text-slate-600 mt-1">Recommended → Approved → Executed → Outcome measured → Learning</p>
        <div className="mt-3 flex items-center gap-1.5">
          {['ALL','PROPOSED','APPROVED','REJECTED','COMPLETED','IN_PROGRESS'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-2.5 py-1 rounded-full text-xs border ${filter===f?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200'}`}>{f}</button>
          ))}
          <span className="ml-2 text-xs text-slate-500 font-mono">{filtered.length} of {inters.length}</span>
        </div>
      </Card>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-1.5 text-xs font-mono">
        {['RECOMMENDED','APPROVED','EXECUTED','MONITORING','OUTCOME','LEARNING','MEMORY'].map((s,i)=>(
          <React.Fragment key={s}>
            <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-200">{s}</span>
            {i<6 && <ArrowRight className="w-3 h-3 text-slate-400"/>}
          </React.Fragment>
        ))}
      </div>

      {filtered.length===0 ? <EmptyState title="No interventions" description="No plans match the filter. Generate a plan from Customer 360 → Run investigation." /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((iv:any)=>{
            const oc = outcomeByIntervention.get(iv.id);
            return (
              <Card key={iv.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{iv.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{iv.customer_id} · {iv.action_type} · Priority {iv.priority}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${iv.status==='APPROVED'?'bg-emerald-50 border-emerald-200 text-emerald-700': iv.status==='REJECTED'?'bg-red-50 border-red-200 text-red-700':'bg-slate-50 border-slate-200 text-slate-700'}`}>{iv.status}</span>
                </div>
                <div className="text-xs text-slate-600 mt-2 line-clamp-2">{iv.description || iv.plan || ''}</div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-2"><Clock className="w-3 h-3"/>{new Date(iv.created_at).toLocaleString()}</div>
                {oc ? (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-xs font-semibold">Observed outcome</div>
                    <div className="text-xs text-slate-600 mt-1">Health {oc.health_before} → {oc.health_after} (Δ {oc.health_delta>0?'+':''}{oc.health_delta}) · Status {oc.status}</div>
                    {oc.notes && <div className="text-xs text-slate-500 mt-1">{oc.notes}</div>}
                  </div>
                ) : <div className="mt-3 text-xs text-slate-500">Outcome not yet measured</div>}
                {iv.status==='PROPOSED' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={async()=>{ await approveIntervention(iv.id,'CSM'); load(); }} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-emerald-500"><CheckCircle2 className="w-3.5 h-3.5"/>Approve</button>
                    <button onClick={async()=>{ await rejectIntervention(iv.id,'Not a fit','CSM'); load(); }} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-xs hover:bg-slate-50"><XCircle className="w-3.5 h-3.5"/>Reject</button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {outcomes.length>0 && (
        <Card>
          <h3 className="text-sm font-semibold">Recent outcomes ({outcomes.length})</h3>
          <div className="mt-2 divide-y divide-slate-100 max-h-64 overflow-auto">
            {outcomes.slice(0,8).map((o:any)=>(
              <div key={o.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <span className="font-mono truncate">{o.intervention_id}</span>
                <span className={`px-2 py-0.5 rounded-full border ${o.status==='SUCCESS'?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-slate-50 border-slate-200 text-slate-600'}`}>{o.status}</span>
                <span className="font-mono">Δ {o.health_delta}</span>
                <span className="text-slate-500">{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
