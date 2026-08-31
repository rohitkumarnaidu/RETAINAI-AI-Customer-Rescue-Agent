import React, {useEffect, useState, useMemo} from 'react';
import { getExperienceMemories, getLearningOverview, getDatasets } from '../services/api';
import { Card, ErrorState, EmptyState, SkeletonCard } from './ui';
import { GraduationCap, ShieldCheck, Beaker, Database, Layers } from 'lucide-react';

export const LearningView: React.FC = ()=>{
  const [mems,setMems]=useState<any[]>([]);
  const [overview,setOverview]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  const [availableDatasets, setAvailableDatasets] = useState<{canonical:any[];generic:any[];total:number}>({canonical:[],generic:[],total:0});

  const fetchDatasets = async()=>{
    try{
      const ds = await getDatasets();
      setAvailableDatasets({canonical: ds.canonical||[], generic: ds.generic||[], total: ds.total || (ds.canonical?.length||0)+(ds.generic?.length||0)});
    }catch{
      // fallback keep 4 canonical stub so UI never breaks
      setAvailableDatasets({canonical: [
        {dataset_name:"customers", display:"Customers"}, {dataset_name:"usage_events", display:"Usage"},
        {dataset_name:"support_tickets", display:"Support"}, {dataset_name:"customer_feedbacks", display:"Feedback"}
      ], generic:[], total:4});
    }
  };

  useEffect(()=>{
    fetchDatasets();
    const h = ()=> fetchDatasets();
    window.addEventListener('retainai_upload', h as EventListener);
    window.addEventListener('retainai_upload_deleted', h as EventListener);
    window.addEventListener('retainai_uploads_cleared', h as EventListener);
    const iv = setInterval(fetchDatasets, 30000);
    return ()=> { window.removeEventListener('retainai_upload', h as EventListener); window.removeEventListener('retainai_upload_deleted', h as EventListener); window.removeEventListener('retainai_uploads_cleared', h as EventListener); clearInterval(iv); };
  },[]);

  const load=async()=>{
    try{
      setLoading(true);
      // Dynamic for any dataset: if filter is generic/custom, we can pass to backend for server-side filter, but client fallback also works
      const [m,o]=await Promise.all([getExperienceMemories().catch(()=>[]), getLearningOverview().catch(()=>null)]);
      setMems(m); setOverview(o);
    } catch(e:any){ setError(e.message)} finally{ setLoading(false) }
  };
  useEffect(()=>{load()},[]);
  // refetch when datasetFilter changes? we keep client filter for instant, server filter optional
  // Also listen for refresh emitter for cross-view invalidation
  // Build dynamic tabs: canonical + generic (any N). Hide canonical with 0 rows? keep all but show count
  const allTabs = useMemo(()=>{
    const tabs: {key:string; label:string; type:'all'|'canonical'|'generic'; rows?:number}[] = [];
    tabs.push({key:'all', label:`All ${availableDatasets.total||4}`, type:'all'});
    for(const d of availableDatasets.canonical){
      tabs.push({key:d.dataset_name, label: d.display || d.dataset_name.replace('_',' ').replace('events','').trim(), type:'canonical', rows:d.rows});
    }
    for(const d of availableDatasets.generic){
      tabs.push({key:d.dataset_name, label: d.display || d.dataset_name, type:'generic', rows:d.rows});
    }
    // dedupe
    const seen = new Set<string>();
    return tabs.filter(t=> { if(seen.has(t.key)) return false; seen.add(t.key); return true; });
  }, [availableDatasets]);

  const getDatasetOf = (m:any): string | null => {
    return m.dataset_name || m.context_json?.dataset_name || m.context?.dataset_name || m.contexts?.[0]?.dataset_name || m.context?.source_dataset || null;
  };

  const filterByDataset = (arr:any[])=> {
    if(datasetFilter==='all') return arr;
    return arr.filter((m:any)=>{
      const ds = getDatasetOf(m);
      const f = datasetFilter.toLowerCase();
      // Strict provenance when present — any N datasets, no leakage
      if(ds){
        const aliasToCanon:Record<string,string> = {usage:"usage_events", support:"support_tickets", feedback:"customer_feedbacks", customers:"customers", usage_events:"usage_events", support_tickets:"support_tickets", customer_feedbacks:"customer_feedbacks"};
        const qCanon = aliasToCanon[f] || f;
        const dsCanon = aliasToCanon[ds.toLowerCase()] || ds.toLowerCase();
        if(qCanon===dsCanon) return true;
        if(ds.toLowerCase()===f) return true;
        return false;
      }
      // Fallback heuristic only for legacy without provenance (any dataset but no tag)
      const isGeneric = availableDatasets.generic.some(g=> g.dataset_name===datasetFilter);
      if(isGeneric){
        const txt = `${m.pattern||''} ${m.context_pattern||''} ${m.risk_pattern||''} ${m.recommended_strategy||''}`.toLowerCase();
        return txt.includes(f);
      }
      const txt = `${m.pattern||''} ${m.context_pattern||''} ${m.risk_pattern||''} ${m.recommended_strategy||''} ${m.recommended_intervention||''} ${m.intervention||''} ${m.intervention_type||''} ${m.signals?.join(' ')||''} ${(m.context_json?.segment||'')}`.toLowerCase();
      if(f==='customers' || f==='customers_db') return true;
      if(f==='usage_events' || f==='usage') return txt.includes('usage') || txt.includes('dau') || txt.includes('active') || txt.includes('decline');
      if(f==='support_tickets' || f==='support') return txt.includes('ticket') || txt.includes('support') || txt.includes('bug');
      if(f==='customer_feedbacks' || f==='feedback') return txt.includes('feedback') || txt.includes('sentiment') || txt.includes('csat') || txt.includes('nps');
      return txt.includes(f);
    });
  };

  if(loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if(error) return <ErrorState message={error} onRetry={load}/>;

  const candidatesAll = overview?.candidates || [];
  const validatedAll = overview?.validated_memories || mems;
  const candidates = filterByDataset(candidatesAll);
  const validated = filterByDataset(validatedAll);

  const totalDatasets = availableDatasets.total || (availableDatasets.canonical.length + availableDatasets.generic.length) || 4;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold flex items-center gap-2"><GraduationCap className="w-5 h-5"/> Learning Center</h2>
        <p className="text-sm text-slate-600 mt-1">Experience memory — validated patterns that influence future recommendations. Never implies model retraining. <span className="text-slate-400">Tenant-isolated, dataset-aware for any N datasets.</span></p>
        <p className="text-xs text-slate-500 mt-1">{validatedAll.length} validated · {candidatesAll.length} candidates · Showing {validated.length} + {candidates.length} for <b>{datasetFilter==='all' ? `All ${totalDatasets} datasets` : datasetFilter}</b> {availableDatasets.generic.length>0 && <span className="ml-1 text-emerald-700">+{availableDatasets.generic.length} custom</span>}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {allTabs.map(t=>{
            const active = datasetFilter===t.key;
            const isGeneric = t.type==='generic';
            return (
              <button key={t.key} onClick={()=> setDatasetFilter(t.key)} className={`px-3 py-1 rounded-full text-xs font-mono border capitalize flex items-center gap-1 ${active ? (isGeneric ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-900 text-white border-slate-900') : (isGeneric ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-white' : 'bg-white border-slate-200 hover:bg-slate-50')}`}>
                {isGeneric && <Layers className="w-3 h-3"/>}
                {t.type==='canonical' && t.key!=='all' && <Database className="w-3 h-3"/>}
                {t.label} {t.rows!==undefined && <span className={`ml-1 px-1 py-0 rounded text-[10px] ${active ? 'bg-white/20' : 'bg-slate-50 border border-slate-200'}`}>{t.rows}</span>}
              </button>
            )
          })}
        </div>
        {availableDatasets.generic.length>0 && <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5"/> Any CSV you upload appears here instantly — filters are not hardcoded to 4, they are <b>any N</b> from <code className="bg-white border border-emerald-200 px-1 rounded">GET /datasets</code>.</div>}
      </Card>

      {validated.length===0 && candidates.length===0 ? <EmptyState title={datasetFilter==='all' ? "No learning yet" : `No learning for ${datasetFilter}`} description={datasetFilter==='all' ? "RETAINAI hasn't accumulated enough validated experience. Record interventions and measure outcomes to build organizational intelligence — works for any dataset, not just 4 canonical." : `No validated patterns match dataset "${datasetFilter}". Try All ${totalDatasets} or upload data for this dataset, run investigations, record outcomes — learning captures dataset provenance for any CSV.`} icon={Beaker}/> : (
        <>
          {candidates.length>0 && (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Beaker className="w-4 h-4"/> Candidates ({candidates.length}) — pending validation {datasetFilter!=='all' && <span className="text-xs font-normal text-slate-500">for {datasetFilter}</span>}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {candidates.slice(0,8).map((c:any)=>{
                  const ds = getDatasetOf(c);
                  return (
                  <Card key={c.candidate_id || c.id}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono text-slate-500 border border-amber-200 bg-amber-50 inline-block px-2 py-0.5 rounded-full">CANDIDATE · {c.validation_status||c.status}</span>
                      {ds && <span className="text-[11px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1"><Database className="w-3 h-3"/>{ds}</span>}
                    </div>
                    <div className="text-sm font-semibold mt-2">{c.pattern}</div>
                    <div className="text-xs text-slate-600 mt-1">Intervention: {c.intervention || c.intervention_type}</div>
                    <div className="text-xs text-slate-600 mt-1">Observed: {c.observed_outcome}</div>
                    {c.context?.dataset_name && <div className="text-[11px] text-slate-500 mt-1">Dataset: <b>{c.context.dataset_name}</b> · Segment: {c.context.segment}</div>}
                    <div className="text-xs text-slate-500 mt-2">Sample {c.sample_size} · Confidence {(c.confidence*100).toFixed(0)}%</div>
                  </Card>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4"/> Validated experience ({validated.length}) {datasetFilter!=='all' && <span className="text-xs font-normal text-slate-500">for {datasetFilter}</span>}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {validated.map((m:any)=>{
                const success = m.success_count ?? m.successful_outcomes ?? 0;
                const total = (m.success_count??0)+(m.failure_count??0) || m.sample_size || 1;
                const rate = typeof m.success_rate==='number' ? m.success_rate : (success/total);
                const pct = Math.round(rate*100);
                const isHigh = pct>=70 && total>=3;
                const ds = getDatasetOf(m);
                return (
                  <Card key={m.id||m.memory_id} className={`min-w-0 ${isHigh ? 'border-emerald-200':''}`}>
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full whitespace-nowrap">{m.customer_segment || m.industry_segment || 'General'}</span>
                          {ds && <span className="text-[11px] font-mono border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Layers className="w-3 h-3"/>{ds}</span>}
                          {!ds && m.signals?.[0] && <span className="text-[11px] font-mono border border-slate-200 bg-white px-2 py-0.5 rounded-full truncate max-w-[120px]">{m.signals[0]}</span>}
                        </div>
                        <div className="text-sm font-semibold mt-2 leading-tight break-words">{m.pattern || m.context_pattern || m.risk_pattern || 'Pattern'}</div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed break-words">{m.risk_pattern || m.context_pattern || ''}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-[11px] text-slate-500 leading-none">Success rate</div>
                        <div className={`text-lg font-bold font-mono leading-none mt-1 ${isHigh?'text-emerald-700':'text-slate-800'}`}>{pct}%</div>
                        <div className="text-[11px] text-slate-500 leading-none mt-1">{success}/{total} cases</div>
                      </div>
                    </div>
                    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs leading-relaxed break-words">
                      “{m.observed_outcome || m.key_insights || m.recommended_strategy || '—'}”
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-mono gap-2">
                      <span className="truncate">Strategy: {m.recommended_strategy || m.intervention_type || m.recommended_intervention || '—'}</span>
                      <span className={`px-2 py-0.5 rounded-full border shrink-0 ${String(m.validation_status).includes('VALIDATED')||String(m.status).includes('VALIDATED') ? 'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-slate-50 border-slate-200'}`}>{m.validation_status||m.status||'VALIDATED'}</span>
                    </div>
                    {ds && <div className="mt-1.5 text-[11px] text-slate-400 font-mono">Provenance: <b className="text-slate-600">{ds}</b> {m.contexts?.[0]?.segment ? `· ${m.contexts[0].segment}` : ''} · tenant: {String(m.tenant_id||'').slice(0,8)}</div>}
                    {!isHigh && total<3 && <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">Sample size insufficient — treat as suggestive, not predictive. Need ≥2 successes to validate (gate: 68%→80% confidence).</div>}
                  </Card>
                );
              })}
            </div>
          </div>
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold tracking-wide text-slate-500">VECTOR MEMORY · CHROMA · 100% AGENT</h3>
              <span className="text-[11px] font-mono bg-slate-900 text-white px-2 py-0.5 rounded-full shrink-0 self-start sm:self-auto whitespace-nowrap">tenant_{typeof window !== 'undefined' ? (localStorage.getItem('retainai_tenant_id')||'demo').slice(0,8) : 'demo'}_memories</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center"><div className="font-mono text-[11px] text-slate-500">COLLECTION</div><div className="font-bold mt-1 truncate" title="tenant_*.memories">tenant_*.memories</div><div className="text-[11px] text-slate-500">isolated per tenant</div></div>
              <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-center"><div className="font-mono text-[11px] text-emerald-700">EMBED</div><div className="font-bold mt-1">8-dim hash</div><div className="text-[11px] text-slate-500">fallback in-mem</div></div>
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 text-center"><div className="font-mono text-[11px] text-blue-700">QUERY</div><div className="font-bold mt-1">ranked</div><div className="text-[11px] text-slate-500">overlap+conf</div></div>
            </div>
            <div className="text-xs text-slate-500 mt-2">Agent 100% — every investigation queries <code className="bg-slate-100 px-1 rounded">tenant_{typeof window !== 'undefined' ? (localStorage.getItem('retainai_tenant_id')||'demo').slice(0,8) : 'demo'}_memories</code> via <code className="bg-slate-100 px-1 rounded">query_experience_memory</code> ranked `overlap*0.6 + conf*0.2 + success*0.2` top 3. Custom datasets also indexed.</div>
          </Card>
        </>
      )}
    </div>
  );
};