import React, { useState, useEffect, useRef } from 'react';
import { getCustomerById, getCustomerTimeline, getCustomerRisk, runInvestigation, approveIntervention, rejectIntervention, getCustomerSignals, getCustomerMemory, getCustomerInterventions, getAgentRuns, ingestEvent, recordOutcome } from '../services/api';
import { RiskBadge, HealthRing, ConfidenceBadge } from './RiskBadge';
import { Card, SectionHeader, Skeleton, ErrorState, EmptyState, EvidenceDrawer } from './ui';
import { Building, Mail, Activity, Bot, FileText, ListOrdered, CheckCircle2, Clock, TrendingDown, ShieldAlert, Zap, ArrowRight, Sparkles, BarChart3, AlertCircle, Check, ChevronRight } from 'lucide-react';

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
  const [success,setSuccess]=useState<string|null>(null);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [approving,setApproving]=useState(false);
  const [approvedId,setApprovedId]=useState<string|null>(null);
  const [timelineFilter,setTimelineFilter]=useState<string>('ALL');
  const [injecting,setInjecting]=useState<string|null>(null);
  // Measure — outcome recording
  const [showOutcomeForm,setShowOutcomeForm]=useState(false);
  const [healthAfter,setHealthAfter]=useState<string>('');
  const [usageAfter,setUsageAfter]=useState<string>('');
  const [customerResponse,setCustomerResponse]=useState('POSITIVE');
  const [outcomeNotes,setOutcomeNotes]=useState('');
  const [recording,setRecording]=useState(false);
  const [outcomeError,setOutcomeError]=useState<string|null>(null);
  const [outcomeSuccess,setOutcomeSuccess]=useState<any>(null);
  const investigationRef = useRef<HTMLDivElement>(null);

  const load = async()=>{
    try{
      setLoading(true); setError(null); setSuccess(null); setResult(null); setApprovedId(null); setOutcomeSuccess(null);
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
      // detect already approved intervention
      const approved = (inters as any[]).find((iv:any)=> iv.status==='APPROVED' || iv.status==='COMPLETED');
      if(approved) setApprovedId(approved.id);
    } catch(e:any){ setError(e.message||'Failed to load'); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[customerId]);
  useEffect(()=>{ if(success){ const id=setTimeout(()=>setSuccess(null),4000); return ()=>clearTimeout(id);}},[success]);

  const handleInvestigate = async()=>{
    try{
      setInvestigating(true); setError(null); setSuccess(null);
      const r = await runInvestigation(customerId);
      setResult(r);
      setSuccess(`Investigation ${r.run_id} completed — root cause identified with ${r.investigation.evidence_ids?.length||0} evidence items`);
      const [updatedRisk, updatedTl, updatedRuns, updatedInters] = await Promise.all([
        getCustomerRisk(customerId).catch(()=>null),
        getCustomerTimeline(customerId,60).catch(()=>[]),
        getAgentRuns(customerId).catch(()=>[]),
        getCustomerInterventions(customerId).catch(()=>[]),
      ]);
      setRisk(updatedRisk); setTimeline(updatedTl); setRuns(Array.isArray(updatedRuns)?updatedRuns:[]); setInterventions(Array.isArray(updatedInters)?updatedInters:[]);
      setTimeout(()=> investigationRef.current?.scrollIntoView({behavior:'smooth', block:'start'}), 100);
    } catch(e:any){ setError(e.message||'Investigation failed'); }
    finally{ setInvestigating(false); }
  };

  const handleApprove = async()=>{
    const id=result?.intervention_id; if(!id) return;
    try{ setApproving(true); await approveIntervention(id, customer?.csm_name||'CSM'); setApprovedId(id); setSuccess(`Approved ${id.slice(0,12)} — moved to MEASURE. Now record outcome after 14d window (or demo now).`); const updated = await getCustomerInterventions(customerId).catch(()=>[]); setInterventions(Array.isArray(updated)?updated:[]); }
    catch(e:any){ setError(e.message||'Approve failed'); }
    finally{ setApproving(false); }
  };
  const handleReject = async()=>{
    const id=result?.intervention_id; if(!id) return;
    try{ await rejectIntervention(id, 'Not relevant for this account', customer?.csm_name||'CSM'); setResult(null); setSuccess('Recommendation rejected — feedback captured for learning (loop: FEEDBACK → LEARN)'); }
    catch(e:any){ setError(e.message||'Reject failed'); }
  };
  const handleInject = async(type:string)=>{
    setInjecting(type); setError(null); setSuccess(null);
    try{
      let payload:any={};
      if(type==='USAGE_EVENT') payload={daily_active_users: 8+Math.floor(Math.random()*5), license_utilization:0.12, feature_clicks:12, sessions:9, id:`usg_live_${Date.now()}`};
      if(type==='SUPPORT_TICKET') payload={severity:'CRITICAL', status:'OPEN', subject:`Live: Export fails #${String(Date.now()).slice(-4)}`, description:'Injected via Live Data panel — agent will cite this evidence', id:`tck_live_${Date.now()}`};
      if(type==='CUSTOMER_FEEDBACK') payload={sentiment:'NEGATIVE', text:'Live feedback: workflow broken, need help', score:2, sentiment_score:-0.9, id:`fb_live_${Date.now()}`};
      const res = await ingestEvent(customerId, type, payload);
      const [updatedRisk, updatedTl, updatedSignals] = await Promise.all([getCustomerRisk(customerId).catch(()=>null), getCustomerTimeline(customerId,60).catch(()=>[]), getCustomerSignals(customerId).catch(()=>[])]);
      setRisk(updatedRisk); setTimeline(updatedTl); setSignals(Array.isArray(updatedSignals)?updatedSignals:updatedSignals as any);
      setSuccess(`Injected ${type} → ${res.status} (health ${updatedRisk?.health_score ?? '—'} ${updatedRisk?.risk_level ?? ''}) — now click Run investigation`);
    }catch(e:any){ setError(e.message||'Inject failed');}
    finally{ setInjecting(null); }
  };

  const handleRecordOutcome = async(e:React.FormEvent)=>{
    e.preventDefault();
    const targetId = approvedId || result?.intervention_id || interventions.find((iv:any)=>iv.status==='APPROVED')?.id;
    if(!targetId){ setOutcomeError('No approved intervention to measure'); return; }
    const before = Number(risk?.health_score ?? customer?.health_score ?? 70);
    const after = Number(healthAfter);
    if(Number.isNaN(after) || after<0 || after>100){ setOutcomeError('Health after must be 0-100'); return; }
    setRecording(true); setOutcomeError(null);
    try{
      const oc = await recordOutcome(targetId, { health_before: before, health_after: after, usage_before: 50, usage_after: Number(usageAfter) || after, customer_response: customerResponse, notes: outcomeNotes });
      setOutcomeSuccess(oc);
      setSuccess(`Outcome recorded: ${before} → ${after} (Δ ${oc.health_delta>0?'+':''}${oc.health_delta}) Status ${oc.status} — ${oc.status==='SUCCESS' ? 'Validated memory created (LEARN)' : 'No memory (neutral/failed)'} `);
      setShowOutcomeForm(false);
      // refresh
      const [updatedInters] = await Promise.all([getCustomerInterventions(customerId).catch(()=>[])]);
      setInterventions(Array.isArray(updatedInters)?updatedInters:[]);
      // also refresh risk
      const nr = await getCustomerRisk(customerId).catch(()=>null); if(nr) setRisk(nr);
    }catch(er:any){ setOutcomeError(er?.response?.data?.detail || er.message || 'Record failed'); }
    finally{ setRecording(false); }
  };

  if(loading) return <div className="space-y-4"><div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"><Skeleton className="h-6 w-1/3"/><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-2/3"/></div><div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><Card key={i}><Skeleton className="h-20 w-full"/></Card>)}</div></div>;
  if(!customer) return <EmptyState title="Customer not found" description="Select an account from Command Center or Customers." />;
  const riskLevel = (risk?.risk_level as string | undefined) ?? null;
  const rawHealthScore = risk?.health_score ?? customer.health_score ?? null;
  const healthScore = rawHealthScore != null ? Number(rawHealthScore) : null;
  const hasHealthScore = healthScore != null && !Number.isNaN(healthScore);
  const healthComps = risk?.health_components || {};
  const rootCause = (risk?.primary_root_cause ?? risk?.root_cause ?? (signals.length>0 ? (signals[0]?.summary || signals[0]?.description || signals[0]?.signal_type) : null) ?? '—');
  const reasoning = risk?.reasoning_summary ?? (risk?.explanation as string | undefined) ?? '—';
  const derivedConfidence = risk?.confidence ?? (signals.length ? Math.min(0.95, 0.65 + signals.length*0.08) : null);
  const showInsufficientEvidence = !hasHealthScore || !risk || riskLevel==null;
  const filteredTimeline = timeline.filter((e:any)=>{
    if(timelineFilter==='ALL') return true;
    const src=(e.source||e.type||'').toUpperCase();
    return src.includes(timelineFilter);
  });

  // Dynamic lifecycle: 0 SENSE, 1 THINK, 2 ACT, 3 MEASURE, 4 LEARN
  const hasSignal = signals.length>0;
  const hasResult = !!result;
  const hasApproved = !!approvedId || interventions.some((iv:any)=>['APPROVED','COMPLETED','EXECUTED'].includes(iv.status));
  const hasMeasured = !!outcomeSuccess;
  const stepIndex = hasMeasured ? 4 : hasApproved ? 3 : hasResult ? 2 : hasSignal ? 1 : 0;
  const stepLabels = ['SENSE','THINK','ACT','MEASURE','LEARN'];
  const stepDescs = ['Telemetry ingested','Investigating evidence','Awaiting approval','Measuring outcome','Learning validated'];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
        <span>Customers</span> <ChevronRight className="w-3 h-3"/> <span className="text-slate-700 font-medium">{customer.name}</span> <span className="text-slate-400">· 360</span>
      </div>

      {/* Stepper */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center justify-between gap-1">
          {stepLabels.map((s,i)=>(
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1 flex-1">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border ${i<stepIndex ? 'bg-emerald-600 text-white border-emerald-600' : i===stepIndex ? 'bg-slate-900 text-white border-slate-900 animate-pulse' : 'bg-white border-slate-200 text-slate-500'}`}>{i<stepIndex ? <Check className="w-3.5 h-3.5"/> : i+1}</span>
                <span className={`text-[11px] font-mono font-medium ${i===stepIndex ? 'text-slate-900' : i<stepIndex ? 'text-emerald-700' : 'text-slate-500'}`}>{s}</span>
                <span className="text-[11px] text-slate-400 hidden sm:block">{stepDescs[i]}</span>
              </div>
              {i<4 && <div className={`flex-1 h-0.5 mx-1 ${i<stepIndex ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="text-xs text-slate-600 mt-2 text-center">
          {stepIndex===0 && <>Start in <b>SENSE</b>: inject live data or import CSV, then run investigation</>}
          {stepIndex===1 && <>Signals detected — run <b>THINK</b>: click <b>Run investigation</b></>}
          {stepIndex===2 && <>Plan ready in <b>ACT</b>: approve or reject the recommendation</>}
          {stepIndex===3 && <>Approved — in <b>MEASURE</b>: record outcome after 14d (or demo now via <b>Record Outcome</b>)</>}
          {stepIndex===4 && <>Outcome measured — <b>LEARN</b> validated. Loop restarts at SENSE.</>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {hasHealthScore ? <HealthRing score={healthScore!} size={64} /> : <div className="w-[64px] h-[64px] rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xl" aria-label="Health score unavailable">—</div>}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">{customer.name}</h1>
              {riskLevel ? <RiskBadge level={riskLevel} size="md" /> : <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-500 px-2.5 py-1 text-xs font-mono" aria-label="Risk level unavailable">—</span>}
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
      {showInsufficientEvidence && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-800">INSUFFICIENT_EVIDENCE — sparse telemetry</div>
            <div className="text-xs text-amber-700 mt-1 leading-relaxed">Health score unavailable and risk assessment missing. Inject live data or run investigation once telemetry exists. Showing “—” instead of fabricated value.</div>
          </div>
        </div>
      )}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2.5 rounded-lg flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0"/><span>{success}</span></div>}

      <Card>
        <SectionHeader title="Inject Live Data (SENSE)" subtitle="Add real telemetry — DB persists, health/risk reassesses instantly, then Run investigation to see agent tools + report" icon={Zap} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button onClick={()=>handleInject('USAGE_EVENT')} disabled={!!injecting} className="inline-flex items-center justify-center gap-1.5 border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-50">
            {injecting==='USAGE_EVENT' ? <><div className="w-3.5 h-3.5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"/><span>Injecting…</span></> : <><TrendingDown className="w-3.5 h-3.5"/>Inject Usage Drop (DAU 8)</>}
          </button>
          <button onClick={()=>handleInject('SUPPORT_TICKET')} disabled={!!injecting} className="inline-flex items-center justify-center gap-1.5 border border-red-200 bg-red-50 text-red-700 px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
            {injecting==='SUPPORT_TICKET' ? <><div className="w-3.5 h-3.5 border-2 border-red-700 border-t-transparent rounded-full animate-spin"/><span>Injecting…</span></> : <><FileText className="w-3.5 h-3.5"/>Inject Support Ticket (CRITICAL)</>}
          </button>
          <button onClick={()=>handleInject('CUSTOMER_FEEDBACK')} disabled={!!injecting} className="inline-flex items-center justify-center gap-1.5 border border-violet-200 bg-violet-50 text-violet-700 px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-violet-100 disabled:opacity-50">
            {injecting==='CUSTOMER_FEEDBACK' ? <><div className="w-3.5 h-3.5 border-2 border-violet-700 border-t-transparent rounded-full animate-spin"/><span>Injecting…</span></> : <><Mail className="w-3.5 h-3.5"/>Inject Negative Feedback (CSAT 2)</>}
          </button>
        </div>
        <div className="text-xs text-slate-500 mt-2">Each click <code className="bg-slate-100 px-1 py-0.5 rounded">POST /events</code> → <code className="bg-slate-100 px-1 py-0.5 rounded">SystemEventLog</code> → <code className="bg-slate-100 px-1 py-0.5 rounded">reassess_customer_risk</code> → timeline & signals update. Then <b>Run investigation</b> to see agent working (tools → report).</div>
      </Card>

      <Card>
        <SectionHeader title="Why this customer is at risk" subtitle="Evidence-linked explanation — not a black-box score" icon={ShieldAlert} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{hasHealthScore ? Math.round(healthScore!) : "—"}<span className="text-sm font-normal text-slate-400">/100</span></span>
              <span className="text-sm flex items-center gap-1 text-slate-600"><TrendingDown className="w-4 h-4"/> {riskLevel ?? "—"}</span>
              {derivedConfidence!=null ? <span className="text-xs font-mono text-slate-500">Confidence {(derivedConfidence*100).toFixed(0)}%</span> : <span className="text-xs font-mono text-slate-400">Confidence —</span>}
            </div>
            {rootCause==="—" && reasoning==="—" ? (
              <div className="mt-3">
                <EmptyState title="No risk signal" description="No root cause or reasoning available — signals will appear after telemetry is ingested and risk is reassessed." />
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Primary root cause</div>
                <div className="text-sm font-semibold text-slate-900 mt-1">{rootCause==="—" ? "—" : rootCause}</div>
                <div className="text-sm text-slate-600 leading-relaxed mt-1">{reasoning==="—" ? "—" : reasoning}</div>
                {rootCause==="—" && <div className="text-xs text-slate-500 mt-1">Showing "—" per dynamic honesty rule.</div>}
              </div>
            )}
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

      <div ref={investigationRef} />
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
                {/* MEASURE */}
                {approvedId && !outcomeSuccess && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold flex items-center gap-1.5"><BarChart3 className="w-4 h-4"/> MEASURE: Record outcome</div>
                      <button onClick={()=>setShowOutcomeForm(v=>!v)} className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${showOutcomeForm?'bg-slate-900 text-white border-slate-900':'bg-white hover:bg-slate-50'}`}>{showOutcomeForm ? 'Cancel' : 'Record Outcome'}</button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">After intervention, measure health delta. In production this is 14d; demo allows immediate recording. <b>Success = Δ≥15 → Validated memory (LEARN)</b></p>
                    {showOutcomeForm && (
                      <form onSubmit={handleRecordOutcome} className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-medium">Health before</label><input value={String(risk?.health_score ?? customer.health_score ?? 70)} readOnly className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-slate-100"/><div className="text-[11px] text-slate-500">Current health</div></div>
                          <div><label className="text-xs font-medium">Health after *</label><input type="number" min={0} max={100} required value={healthAfter} onChange={e=>setHealthAfter(e.target.value)} placeholder="e.g. 78" className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"/><div className="text-[11px] text-slate-500">0-100 after intervention</div></div>
                          <div><label className="text-xs font-medium">Usage after</label><input type="number" min={0} max={100} value={usageAfter} onChange={e=>setUsageAfter(e.target.value)} placeholder="auto = health after" className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"/></div>
                          <div><label className="text-xs font-medium">Customer response</label><select value={customerResponse} onChange={e=>setCustomerResponse(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"><option>POSITIVE</option><option>NEUTRAL</option><option>NEGATIVE</option></select></div>
                        </div>
                        <div><label className="text-xs font-medium">Notes</label><textarea value={outcomeNotes} onChange={e=>setOutcomeNotes(e.target.value)} placeholder="What was done, customer feedback..." rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"/></div>
                        {outcomeError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-1.5 rounded-lg flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0"/>{outcomeError}</div>}
                        <button type="submit" disabled={recording} className="inline-flex items-center gap-1.5 bg-[#0F172A] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50">{recording ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>Recording...</> : <><BarChart3 className="w-3.5 h-3.5"/>Submit outcome</>}</button>
                      </form>
                    )}
                    {outcomeSuccess && <div className="mt-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1.5 rounded-lg">Outcome {outcomeSuccess.status} Δ {outcomeSuccess.health_delta} → Learning updated</div>}
                  </div>
                )}
                {outcomeSuccess && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5"><Check className="w-3.5 h-3.5"/> Outcome measured — {outcomeSuccess.status}</div>
                    <div className="text-xs text-emerald-700 mt-1">Health {outcomeSuccess.health_before} → {outcomeSuccess.health_after} (Δ {outcomeSuccess.health_delta>0?'+':''}{outcomeSuccess.health_delta}) · {outcomeSuccess.status==='SUCCESS' ? 'Validated memory created — future recommendations improved' : 'Neutral/failed — no memory, but feedback recorded'}</div>
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">Evidence, interpretation, recommendation, action, outcome, learning — keep them distinct. Human approval required before execution.</div>
              </div>
            )}
            {/* Agent working trace */}
            <div className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="text-xs font-semibold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> Agent trace — how the report was produced (tools → state transitions)</div>
              <div className="mt-2 space-y-1 max-h-40 overflow-auto pr-1">
                {(result.state_history||[]).length===0 && <div className="text-xs text-slate-500">No state history — run was via fallback. Real runs show 12 transitions.</div>}
                {(result.state_history||[]).slice(0,12).map((h:any,i:number)=>(
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400">{i+1}.</span>
                    <span>{h.from} → {h.to}</span>
                    {h.tool && <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded text-[11px]">{h.tool}</span>}
                    {h.latency_ms && <span className="text-slate-500">{h.latency_ms}ms</span>}
                    {h.error && <span className="text-red-600 truncate max-w-[180px]">{h.error}</span>}
                  </div>
                ))}
              </div>
              {result.health_dimensions && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {Object.entries(result.health_dimensions as any).map(([k,v]:any)=>(
                    <div key={k} className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-center">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">{k}</div>
                      <div className="text-sm font-semibold">{Math.round(Number(v))}</div>
                    </div>
                  ))}
                </div>
              )}
              {result.structured_output && <details className="mt-2"><summary className="text-xs font-mono text-slate-600 cursor-pointer">structured_output (validated JSON)</summary><pre className="text-xs bg-slate-950 text-slate-200 rounded p-2 mt-1 overflow-auto max-h-32">{JSON.stringify(result.structured_output, null, 2)}</pre></details>}
            </div>
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
                  <div key={iv.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 cursor-pointer" onClick={()=>{ if(iv.status==='APPROVED'){ setShowOutcomeForm(true); investigationRef.current?.scrollIntoView({behavior:'smooth'});} }}>
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium truncate">{iv.title}</span><span className={`text-[11px] border px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${iv.status==='APPROVED'?'bg-emerald-50 border-emerald-200 text-emerald-700': iv.status==='REJECTED'?'bg-red-50 border-red-200 text-red-700':'bg-slate-50 border-slate-200'}`}>{iv.status}</span></div>
                    <div className="text-xs text-slate-600 mt-1 truncate">{iv.description||iv.plan||''}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{new Date(iv.created_at).toLocaleDateString()} · {iv.action_type}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionHeader title="Relevant experience" subtitle="Validated patterns for this segment" icon={Zap} />
            {memory.length===0 ? <div className="text-xs text-slate-500">No validated memories for {customer.segment} yet. <span className="text-slate-400">Complete MEASURE to build memory.</span></div> : (
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
              {stepLabels.map((s,i)=>(
                <React.Fragment key={s}>
                  <span className={`px-2 py-1 rounded-full border transition ${i===stepIndex ? 'bg-slate-900 text-white border-slate-900 font-bold' : i<stepIndex ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white border-slate-200 text-slate-500'}`}>{s}</span>
                  {i<4 && <ArrowRight className={`w-3 h-3 ${i<stepIndex ? 'text-emerald-500' : 'text-slate-400'}`}/>}
                </React.Fragment>
              ))}
            </div>
            <div className="text-xs text-slate-600 mt-2">
              {stepIndex===0 && <>SENSE: inject or upload data.</>}
              {stepIndex===1 && <>THINK: signals found → run investigation.</>}
              {stepIndex===2 && <>ACT: plan ready → approve/reject.</>}
              {stepIndex===3 && <>MEASURE: record outcome below.</>}
              {stepIndex===4 && <>LEARN: outcome validated — repeat from SENSE.</>}
              <span className="text-slate-400"> Step {stepIndex+1}/5</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};