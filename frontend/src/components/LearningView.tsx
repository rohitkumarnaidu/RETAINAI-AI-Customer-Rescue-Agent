import React, {useEffect, useState} from 'react';
import { getExperienceMemories, getLearningOverview } from '../services/api';
import { Card, ErrorState, EmptyState, SkeletonCard } from './ui';
import { GraduationCap, ShieldCheck, Beaker } from 'lucide-react';

export const LearningView: React.FC = ()=>{
  const [mems,setMems]=useState<any[]>([]);
  const [overview,setOverview]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [datasetFilter, setDatasetFilter] = useState<'all'|'customers'|'usage'|'support'|'feedback'>('all');

  const load=async()=>{
    try{
      setLoading(true);
      const [m,o]=await Promise.all([getExperienceMemories().catch(()=>[]), getLearningOverview().catch(()=>null)]);
      setMems(m); setOverview(o);
    } catch(e:any){ setError(e.message)} finally{ setLoading(false) }
  };
  useEffect(()=>{load()},[]);

  if(loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load}/>;

  const candidatesAll = overview?.candidates || [];
  const validatedAll = overview?.validated_memories || mems;
  const filterByDataset = (arr:any[])=> datasetFilter==='all' ? arr : arr.filter((m:any)=>{
    const txt = `${m.pattern||''} ${m.context_pattern||''} ${m.risk_pattern||''} ${m.recommended_strategy||''} ${m.signals?.join(' ')||''}`.toLowerCase();
    if(datasetFilter==='customers') return true;
    if(datasetFilter==='usage') return txt.includes('usage') || txt.includes('dau') || txt.includes('active') || txt.includes('decline');
    if(datasetFilter==='support') return txt.includes('ticket') || txt.includes('support') || txt.includes('bug');
    if(datasetFilter==='feedback') return txt.includes('feedback') || txt.includes('sentiment') || txt.includes('csat') || txt.includes('nps');
    return true;
  });
  const candidates = filterByDataset(candidatesAll);
  const validated = filterByDataset(validatedAll);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold flex items-center gap-2"><GraduationCap className="w-5 h-5"/> Learning Center</h2>
        <p className="text-sm text-slate-600 mt-1">Experience memory — validated patterns that influence future recommendations. Never implies model retraining.</p>
        <p className="text-xs text-slate-500 mt-1">{validatedAll.length} validated · {candidatesAll.length} candidates · Showing {validated.length} + {candidates.length} for <b>{datasetFilter==='all' ? 'All 4 datasets' : datasetFilter}</b></p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {(['all','customers','usage','support','feedback'] as const).map(f=>(
            <button key={f} onClick={()=> setDatasetFilter(f)} className={`px-3 py-1 rounded-full text-xs font-mono border capitalize ${datasetFilter===f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{f==='all' ? 'All 4' : f}</button>
          ))}
        </div>
      </Card>

      {validated.length===0 && candidates.length===0 ? <EmptyState title="No learning yet" description="RETAINAI hasn't accumulated enough validated experience. Record interventions and measure outcomes to build organizational intelligence." icon={Beaker}/> : (
        <>
          {candidates.length>0 && (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Beaker className="w-4 h-4"/> Candidates ({candidates.length}) — pending validation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {candidates.slice(0,4).map((c:any)=>(
                  <Card key={c.candidate_id}>
                    <div className="text-xs font-mono text-slate-500 border border-amber-200 bg-amber-50 inline-block px-2 py-0.5 rounded-full">CANDIDATE · {c.validation_status||c.status}</div>
                    <div className="text-sm font-semibold mt-2">{c.pattern}</div>
                    <div className="text-xs text-slate-600 mt-1">Intervention: {c.intervention}</div>
                    <div className="text-xs text-slate-600 mt-1">Observed: {c.observed_outcome}</div>
                    <div className="text-xs text-slate-500 mt-2">Sample {c.sample_size} · Confidence {(c.confidence*100).toFixed(0)}%</div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4"/> Validated experience ({validated.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {validated.map((m:any)=>{
                const success = m.success_count ?? m.successful_outcomes ?? 0;
                const total = (m.success_count??0)+(m.failure_count??0) || m.sample_size || 1;
                const rate = typeof m.success_rate==='number' ? m.success_rate : (success/total);
                const pct = Math.round(rate*100);
                const isHigh = pct>=70 && total>=3;
                return (
                  <Card key={m.id||m.memory_id} className={`min-w-0 ${isHigh ? 'border-emerald-200':''}`}>
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-mono border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full whitespace-nowrap">{m.customer_segment || m.industry_segment || 'General'}</span>
                        <div className="text-sm font-semibold mt-2 leading-tight break-words">{m.pattern || m.context_pattern || m.risk_pattern || 'Pattern'}</div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed break-words">{m.risk_pattern || m.context_pattern || ''}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-[11px] text-slate-500 leading-none">Success rate</div>
                        <div className={`text-lg font-bold font-mono leading-none mt-1 ${isHigh?'text-emerald-700':'text-slate-800'}`}>{pct}%</div>
                        <div className="text-[11px] text-slate-500 leading-none mt-1">{success}/{total} cases</div>
                      </div>
                    </div>
                    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs leading-relaxed">
                      “{m.observed_outcome || m.key_insights || m.recommended_strategy || '—'}”
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>Strategy: {m.recommended_strategy || m.intervention_type || m.recommended_intervention || '—'}</span>
                      <span className={`px-2 py-0.5 rounded-full border ${String(m.validation_status).includes('VALIDATED')||String(m.status).includes('VALIDATED') ? 'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-slate-50 border-slate-200'}`}>{m.validation_status||m.status||'VALIDATED'}</span>
                    </div>
                    {!isHigh && total<3 && <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">Sample size insufficient — treat as suggestive, not predictive.</div>}
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
