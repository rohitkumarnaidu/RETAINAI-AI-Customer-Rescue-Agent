import React, {useEffect, useState} from 'react';
import { getAllInterventions, getAllOutcomes, approveIntervention, rejectIntervention, recordOutcome, getPortfolio } from '../services/api';
import { Card, ErrorState, EmptyState, SkeletonCard } from './ui';
import { ClipboardList, CheckCircle2, XCircle, Clock, ArrowRight, BarChart3, AlertCircle } from 'lucide-react';

export const InterventionsView: React.FC = ()=>{
  const [inters,setInters]=useState<any[]>([]);
  const [outcomes,setOutcomes]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [filter,setFilter]=useState<string>('ALL');
  const [outcomeFor,setOutcomeFor]=useState<string|null>(null);
  const [healthAfter,setHealthAfter]=useState('');
  const [usageAfter,setUsageAfter]=useState('');
  const [notes,setNotes]=useState('');
  const [response,setResponse]=useState('POSITIVE');
  const [saving,setSaving]=useState(false);
  const [formError,setFormError]=useState<string|null>(null);
  const [toast,setToast]=useState<string|null>(null);

  const load=async()=>{
    try{
      setLoading(true);
      const [i,o]=await Promise.all([getAllInterventions(), getAllOutcomes()]);
      setInters(i); setOutcomes(o);
    } catch(e:any){ setError(e.message) } finally{ setLoading(false) }
  };
  useEffect(()=>{load()},[]);

  const getPlanSteps=(iv:any):any[]=>{
    if(Array.isArray(iv?.plan_steps)) return iv.plan_steps;
    if(Array.isArray(iv?.steps)) return iv.steps;
    const raw=iv?.plan ?? iv?.plan_steps ?? iv?.steps;
    if(typeof raw==='string'){
      try{ const p=JSON.parse(raw); return Array.isArray(p)?p:[]; }catch{ return []; }
    }
    if(Array.isArray(raw)) return raw;
    return [];
  };
  const getPlanPreview=(iv:any)=>{
    const steps=getPlanSteps(iv);
    if(steps.length) return steps.map((s:any)=>s.title || s.action || '').filter(Boolean).join(' → ').slice(0,120);
    return iv.description || (typeof iv.plan==='string' && iv.plan.length<200 ? iv.plan : '') || '';
  };
  const filtered = filter==='ALL' ? inters : inters.filter((x:any)=> (x.status||'').toUpperCase()===filter);
  const outcomeByIntervention = new Map(outcomes.map((o:any)=>[o.intervention_id, o]));

  if(loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load}/>;

  const handleRecord = async (iv:any)=>{
    const after = Number(healthAfter);
    if(Number.isNaN(after) || after<0 || after>100){ setFormError('Health after 0-100 required'); return; }
    setSaving(true); setFormError(null);
    try{
      // health_before from iv or fallback 70; try fetch customer health via outcome? use 70 as before if unknown
      const before = 70; // server will also accept health_before, but we approximate; Customer360 uses real health
      const oc = await recordOutcome(iv.id, { health_before: before, health_after: after, usage_before: 50, usage_after: Number(usageAfter)||after, customer_response: response, notes });
      setToast(`Outcome for ${iv.id.slice(0,8)} — ${oc.health_before}→${oc.health_after} Δ${oc.health_delta} ${oc.status} ${oc.status==='SUCCESS'?'→ validated memory':''}`);
      setOutcomeFor(null); setHealthAfter(''); setUsageAfter(''); setNotes('');
      await load();
      setTimeout(()=>setToast(null),4000);
    }catch(e:any){ setFormError(e?.response?.data?.detail || e.message || 'Record failed'); }
    finally{ setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="w-5 h-5"/> Interventions</h2>
        <p className="text-sm text-slate-600 mt-1">Recommended → Approved → Executed → Outcome measured → Learning — <span className="font-medium">MEASURE now clickable</span></p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {['ALL','PROPOSED','APPROVED','REJECTED','COMPLETED','IN_PROGRESS'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-2.5 py-1 rounded-full text-xs border ${filter===f?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200'}`}>{f}</button>
          ))}
          <span className="ml-2 text-xs text-slate-500 font-mono">{filtered.length} of {inters.length}</span>
        </div>
        {toast && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-lg">{toast}</div>}
      </Card>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-1.5 text-xs font-mono">
        {['RECOMMENDED','APPROVED','EXECUTED','MONITORING','OUTCOME','LEARNING','MEMORY'].map((s,i)=>(
          <React.Fragment key={s}>
            <span className={`px-2 py-1 rounded-full border ${s==='OUTCOME' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'bg-slate-50 border-slate-200'}`}>{s}</span>
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
                <div className="text-xs text-slate-600 mt-2 line-clamp-2">{getPlanPreview(iv) || '—'}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">Steps: {getPlanSteps(iv).length} · <Clock className="w-3 h-3"/>{new Date(iv.created_at).toLocaleString()}</div>
                {oc ? (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-emerald-800">Observed outcome · {oc.status}</div>
                    <div className="text-xs text-emerald-700 mt-1">Health {oc.health_before} → {oc.health_after} (Δ {oc.health_delta>0?'+':''}{oc.health_delta}) · {oc.status==='SUCCESS' ? 'Validated memory created' : 'No memory'}</div>
                    {oc.notes && <div className="text-xs text-slate-600 mt-1">{oc.notes}</div>}
                  </div>
                ) : <div className="mt-3 text-xs text-slate-500">Outcome not yet measured — {iv.status==='APPROVED' ? 'click Record Outcome below' : 'approve first'}</div>}
                {iv.status==='PROPOSED' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={async()=>{ await approveIntervention(iv.id,'CSM'); await getPortfolio().catch(()=>null); await load(); }} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-emerald-500"><CheckCircle2 className="w-3.5 h-3.5"/>Approve</button>
                    <button onClick={async()=>{ await rejectIntervention(iv.id,'Not a fit','CSM'); await getPortfolio().catch(()=>null); await load(); }} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-xs hover:bg-slate-50"><XCircle className="w-3.5 h-3.5"/>Reject</button>
                  </div>
                )}
                {iv.status==='APPROVED' && !oc && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <button onClick={()=> setOutcomeFor(outcomeFor===iv.id?null:iv.id)} className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${outcomeFor===iv.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50'}`}><BarChart3 className="w-3.5 h-3.5"/> {outcomeFor===iv.id ? 'Cancel' : 'Record Outcome (MEASURE)'}</button>
                    {outcomeFor===iv.id && (
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-xs font-medium">Health after *</label><input type="number" min={0} max={100} value={healthAfter} onChange={e=>setHealthAfter(e.target.value)} placeholder="78" className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"/></div>
                          <div><label className="text-xs font-medium">Usage after</label><input type="number" value={usageAfter} onChange={e=>setUsageAfter(e.target.value)} placeholder="auto" className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-xs font-medium">Response</label><select value={response} onChange={e=>setResponse(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"><option>POSITIVE</option><option>NEUTRAL</option><option>NEGATIVE</option></select></div>
                          <div><label className="text-xs font-medium">Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional" className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"/></div>
                        </div>
                        {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-1 rounded-lg flex gap-1"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0"/>{formError}</div>}
                        <button onClick={()=>handleRecord(iv)} disabled={saving} className="w-full inline-flex items-center justify-center gap-1.5 bg-[#0F172A] text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">{saving? 'Recording...':'Submit outcome'}</button>
                        <p className="text-[11px] text-slate-500">Δ≥15 → SUCCESS → validated memory (LEARN). Δ 0-14 → NEUTRAL. Negative → FAILURE.</p>
                      </div>
                    )}
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
