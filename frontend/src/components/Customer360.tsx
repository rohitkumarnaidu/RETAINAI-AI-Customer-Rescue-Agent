import React, { useState, useEffect } from 'react';
import { getCustomerById, getCustomerTimeline, getCustomerRisk, runInvestigation, approveIntervention, rejectIntervention, getCustomerSignals, getCustomerMemory, getCustomerInterventions, getAgentRuns } from '../services/api';
import { RiskBadge, HealthRing, ConfidenceBadge } from './RiskBadge';
import { Card, SectionHeader, Skeleton, ErrorState, EmptyState, EvidenceDrawer } from './ui';
import { Building, Mail, Activity, Bot, FileText, ListOrdered, CheckCircle2, Clock, TrendingDown, ShieldAlert, Zap, ArrowRight, Sparkles } from 'lucide-react';

export const Customer360: React.FC<{customerId:string}> = ({customerId})=>{
  const [customer,setCustomer]=useState<any>(null);
  const [timeline,setTimeline]=useState<any[]>([]);
  const [risk,setRisk]=useState<any>(null);
  const [signals,setSignals]=useState<any[]>([]);
  const [memory,setMemory]=useState<any[]>([]);
  const [interventions,setInterventions]=useState<any[]>([]);
  const [runs,setRuns]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [investigating,setInvestigating]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [error,setError]=useState<string|null>(null);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [approving,setApproving]=useState(false);
  const [approvedId,setApprovedId]=useState<string|null>(null);
  const [timelineFilter,setTimelineFilter]=useState<string>('ALL');

  const load = async()=>{
    try{
      setLoading(true); setError(null); setResult(null);
      const [cust, tl, riskResp, sigs, mems, inters, agRuns] = await Promise.all([
        getCustomerById(customerId),
        getCustomerTimeline(customerId,60).catch(()=>[]),
        getCustomerRisk(customerId).catch(()=>null),
        getCustomerSignals(customerId).catch(()=>[]),
        getCustomerMemory(customerId).catch(()=>[]),
        getCustomerInterventions(customerId).catch(()=>[]),
        getAgentRuns(customerId).catch(()=>[]),
      ]);
      setCustomer(cust); setTimeline(tl); setRisk(riskResp); setSignals(Array.isArray(sigs)?sigs:[]); setMemory(Array.isArray(mems)?mems:[]); setInterventions(Array.isArray(inters)?inters:[]); setRuns(Array.isArray(agRuns)?agRuns:[]);
    } catch(e:any){ setError(e.message||'Failed to load'); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[customerId]);

  const handleInvestigate = async()=>{
    try{
      setInvestigating(true); setError(null);
      const r = await runInvestigation(customerId);
      setResult(r);
      const [updatedRisk, updatedTl, updatedRuns, updatedInters] = await Promise.all([
        getCustomerRisk(customerId).catch(()=>null),
        getCustomerTimeline(customerId,60).catch(()=>[]),
        getAgentRuns(customerId).catch(()=>[]),
        getCustomerInterventions(customerId).catch(()=>[]),
      ]);
      setRisk(updatedRisk); setTimeline(updatedTl); setRuns(Array.isArray(updatedRuns)?updatedRuns:[]); setInterventions(Array.isArray(updatedInters)?updatedInters:[]);
    } catch(e:any){ setError(e.message||'Investigation failed'); }
    finally{ setInvestigating(false); }
  };

  const handleApprove = async()=>{
    const id=result?.intervention_id; if(!id) return;
    try{ setApproving(true); await approveIntervention(id, customer?.csm_name||'CSM'); setApprovedId(id); const updated=await getCustomerInterventions(customerId).catch(()=>[]); setInterventions(Array.isArray(updated)?updated:[]); }
    catch(e:any){ setError(e.message||'Approve failed'); }
    finally{ setApproving(false); }
  };
  const handleReject = async()=>{
    const id=result?.intervention_id; if(!id) return;
    try{ await rejectIntervention(id, 'Not relevant for this account', customer?.csm_name||'CSM'); setResult(null); setError('Recommendation rejected — feedback captured for learning'); }
    catch(e:any){ setError(e.message||'Reject failed'); }
  };

  if(loading) return <div className="space-y-4"><div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"><Skeleton className="h-6 w-1/3"/><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-2/3"/></div><div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><Card key={i}><Skeleton className="h-20 w-full"/></Card>)}</div></div>;
  if(!customer) return <EmptyState title="Customer not found" description="Select an account from Command Center or Customers." />;
  const riskLevel = risk?.risk_level || 'HEALTHY';
  const healthScore = risk?.health_score ?? customer.health_score ?? 85;
  const healthComps = risk?.health_components || {};
  const rootCause = risk?.primary_root_cause || risk?.root_cause || 'No severe risk detected';
  const reasoning = risk?.reasoning_summary || 'Telemetry within nominal ranges.';
  const filteredTimeline = timeline.filter((e:any)=>{
    if(timelineFilter==='ALL') return true;
    const src=(e.source||e.type||'').toUpperCase();
    return src.includes(timelineFilter);
  });

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <HealthRing score={healthScore} size={64} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">{customer.name}</h1>
              <RiskBadge level={riskLevel} size="md" />
              {customer.is_false_positive_candidate && <span className="text-xs border border-amber-200 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-mono">False-positive candidate</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 font-mono">
              <span className="inline-flex items-center gap-1"><Building className="w-3 h-3"/>{customer.domain}</span>
              <span>·</span><span>{customer.industry}</span><span>·</span><span>{customer.segment}</span>
              <span>·</span><span className="text-slate-700 font-medium">{customer.plan}</span>
              <span>·</span><span className="text-emerald-700 font-semibold">${customer.arr.toLocaleString()} ARR</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Renewal {customer.renewal_date} · Lifecycle {customer.lifecycle_stage} · CSM {customer.csm_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleInvestigate} disabled={investigating} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
            {investigating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/><span>Investigating…</span></> : <><Sparkles className="w-4 h-4"/>Run investigation</>}
          </button>
        </div>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}

      <Card>
        <SectionHeader title="Why this customer is at risk" subtitle="Evidence-linked explanation — not a black-box score" icon={ShieldAlert} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{Math.round(healthScore)}<span className="text-sm font-normal text-slate-400">/100</span></span>
              <span className="text-sm flex items-center gap-1 text-slate-600"><TrendingDown className="w-4 h-4"/> {riskLevel}</span>
              {risk?.confidence !==undefined && <span className="text-xs font-mono text-slate-500">Confidence {(risk.confidence*100).toFixed(0)}%</span>}
            </div>
            <div className="mt-3">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Primary root cause</div>
              <div className="text-sm font-semibold text-slate-900 mt-1">{rootCause}</div>
              <div className="text-sm text-slate-600 leading-relaxed mt-1">{reasoning}</div>
            </div>
            {risk?.health_components && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {Object.entries(healthComps).map(([k,v]:any)=>(
                  <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <div className="text-[11px] font-mono text-slate-500 uppercase">{k}</div>
                    <div className={`text-lg font-semibold ${Number(v)<50?'text-red-600': Number(v)<75?'text-amber-600':'text-teal-700'}`}>{Math.round(Number(v))}</div>
                  </div>
                ))}
              </div>
            )}
            {signals.length>0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-700">Detected signals</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {signals.slice(0,8).map((s:any)=>(
                    <span key={s.id||s.signal_type} className="text-xs border border-slate-200 bg-white px-2 py-1 rounded-full">{s.signal_type||s.category} · {s.severity}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold">Account</div>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-500">CSM</span><span className="font-medium">{customer.csm_name}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Email</span><span className="font-mono text-xs">{customer.csm_email}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Segment</span><span>{customer.segment}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Status</span><span>{customer.status||'ACTIVE'}</span></div>
            </div>
            <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="font-semibold">How to use this view</div>
              <div className="text-slate-600 leading-relaxed">Verify evidence, check investigation confidence, then act. Evidence IDs are clickable and resolve to real records.</div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Investigation" subtitle={result ? `Run ${result.run_id} · ${result.investigation?.uncertainty_status||'READY'}` : 'Run investigation to generate evidence-grounded diagnosis'} icon={Bot} action={result && <button onClick={()=>setDrawerOpen(true)} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5"/>Evidence ({result.investigation.evidence_ids?.length||0})</button>} />
        {!result ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-amber-900">No investigation yet for this view</div>
              <div className="text-sm text-amber-800 mt-1">Click “Run investigation” to execute SENSE → THINK (health/risk/signal engines + LLM synthesis) → ACT. Evidence will be cited with resolvable IDs.</div>
            </div>
            {runs.length>0 && (
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">Recent agent runs ({runs.length})</div>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {runs.slice(0,4).map((r:any)=>(
                    <div key={r.id} className="border border-slate-200 rounded-lg p-3 text-xs">
                      <div className="flex justify-between"><span className="font-mono">{r.id}</span><span className={r.status==='COMPLETED'?'text-emerald-700':'text-amber-700'}>{r.status}</span></div>
                      <div className="text-slate-600 mt-1 truncate">{r.output_summary||r.input_summary||'—'}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{new Date(r.started_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold tracking-wide uppercase text-slate-700 inline-flex items-center gap-1.5"><ShieldAlert className="w-4 h-4"/> Root cause</div>
                <ConfidenceBadge confidence={result.investigation.confidence} uncertainty={result.investigation.uncertainty_status} />
              </div>
              <div className="text-sm font-semibold mt-2">{result.investigation.root_cause}</div>
              <div className="text-sm text-slate-700 leading-relaxed mt-1">{result.investigation.summary}</div>
              {result.investigation.missing_evidence?.length>0 && (
                <div className="mt-3 text-xs bg-white border border-amber-200 rounded-lg p-2.5">
                  <span className="font-semibold text-amber-800">Missing / weak evidence:</span> <span className="text-slate-600">{result.investigation.missing_evidence.join(' · ')}</span>
                </div>
              )}
            </div>

            {result.investigation.evidence_ids?.length>0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.investigation.evidence_ids.map((id:string)=>(
                  <span key={id} className="font-mono text-[11px] border border-slate-200 bg-white px-2 py-1 rounded-full">{id}</span>
                ))}
              </div>
            )}

            {result.retention_plan && (
              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-xs font-semibold tracking-wide uppercase flex items-center gap-1.5"><ListOrdered className="w-4 h-4"/> Recommended action plan</div>
                  <div className="flex items-center gap-2">
                    {!approvedId ? (
                      <>
                        <button onClick={handleReject} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Reject</button>
                        <button onClick={handleApprove} disabled={approving} className="text-xs bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-1.5">
                          {approving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>: <CheckCircle2 className="w-3.5 h-3.5"/>} Approve
                        </button>
                      </>
                    ) : <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>Approved {approvedId.slice(0,12)}…</span>}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                  <div className="text-sm font-semibold">{result.retention_plan.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{result.retention_plan.objective || result.retention_plan.description}</div>
                  <div className="text-xs mt-2 flex gap-2"><span className="border border-slate-200 bg-white px-2 py-0.5 rounded-full">{result.retention_plan.action_type}</span><span className="border border-slate-200 bg-white px-2 py-0.5 rounded-full">Priority {result.retention_plan.priority}</span></div>
                </div>
                <div className="space-y-2">
                  {result.retention_plan.plan_steps?.map((s:any,i:number)=>(
                    <div key={i} className="flex gap-3 border border-slate-200 rounded-lg p-3 bg-white">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">{s.step||i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{s.title}</span><span className="text-xs font-mono text-slate-500">Owner {s.owner}</span></div>
                        <div className="text-xs text-slate-600 mt-0.5">{s.action}</div>
                        {s.target_date && <div className="text-[11px] text-slate-400 mt-1">Target {s.target_date}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {result.retention_plan.draft_email && (
                  <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
                    <div className="text-xs font-semibold flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Outreach email</div>
                    <div className="text-xs font-medium mt-1">Subject: {result.retention_plan.draft_email.subject}</div>
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed mt-2 bg-slate-50 border border-slate-200 rounded p-2.5">{result.retention_plan.draft_email.body}</pre>
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">Evidence, interpretation, recommendation, action, outcome, learning — keep them distinct. Human approval required before execution.</div>
              </div>
            )}
          </div>
        )}
      </Card>
      <EvidenceDrawer ids={result?.investigation.evidence_ids||[]} open={drawerOpen} onClose={()=>setDrawerOpen(false)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionHeader title={`Timeline (${filteredTimeline.length})`} subtitle="Usage · Support · Feedback · Account · Risk changes · Interventions" icon={Clock} action={
            <div className="flex gap-1">
              {['ALL','USAGE','SUPPORT','FEEDBACK','ACCOUNT'].map(f=>(
                <button key={f} onClick={()=>setTimelineFilter(f)} className={`px-2 py-1 rounded-full text-xs border ${timelineFilter===f?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200'}`}>{f}</button>
              ))}
            </div>
          }/>
          {filteredTimeline.length===0 ? <EmptyState title="No timeline events" description="No telemetry in the selected window." /> : (
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1 scrollbar-thin">
              {filteredTimeline.map((e:any)=>(
                <div key={e.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-500">{new Date(e.timestamp).toLocaleString()}</span>
                    <span className="text-[11px] border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full font-mono uppercase">{e.source || e.type || e.event_type || 'EVENT'}</span>
                  </div>
                  <div className="text-sm font-medium mt-1">{e.title}</div>
                  {e.description && <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{e.description}</div>}
                  {e.details && <div className="text-[11px] text-slate-500 mt-1 truncate">{JSON.stringify(e.details).slice(0,120)}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionHeader title="Intervention history" subtitle={`${interventions.length} plans`} icon={Activity} />
            {interventions.length===0 ? <div className="text-xs text-slate-500">No interventions yet. Run investigation to generate a plan.</div> : (
              <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                {interventions.slice(0,6).map((iv:any)=>(
                  <div key={iv.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium truncate">{iv.title}</span><span className="text-[11px] border border-slate-200 px-2 py-0.5 rounded-full">{iv.status}</span></div>
                    <div className="text-xs text-slate-600 mt-1 truncate">{iv.description||iv.plan||''}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{new Date(iv.created_at).toLocaleDateString()} · {iv.action_type}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionHeader title="Relevant experience" subtitle="Validated patterns for this segment" icon={Zap} />
            {memory.length===0 ? <div className="text-xs text-slate-500">No validated memories for {customer.segment} yet.</div> : (
              <div className="space-y-2">
                {memory.slice(0,3).map((m:any)=>(
                  <div key={m.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="text-xs font-semibold">{m.pattern||m.risk_pattern||m.context_pattern}</div>
                    <div className="text-xs text-slate-600 mt-1">Strategy: {m.recommended_strategy||m.recommended_intervention}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Confidence {(m.confidence*100).toFixed(0)}% · Sample {m.sample_size||m.success_count||1}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <div className="text-xs font-semibold">Lifecycle</div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-mono">
              {['SENSE','THINK','ACT','MEASURE','LEARN'].map((s,i)=>(
                <React.Fragment key={s}>
                  <span className={`px-2 py-1 rounded-full border ${i===1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}>{s}</span>
                  {i<4 && <ArrowRight className="w-3 h-3 text-slate-400"/>}
                </React.Fragment>
              ))}
            </div>
            <div className="text-xs text-slate-600 mt-2">You are in THINK → ACT. Approve to move to MEASURE.</div>
          </Card>
        </div>
      </div>
    </div>
  );
};
