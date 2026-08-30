import React, { useState, useEffect } from 'react';
import {
  Customer,
  TimelineEvent,
  getCustomerById,
  getCustomerTimeline,
  getCustomerRisk,
  runInvestigation,
  FullAgentInvestigationResponse,
  approveIntervention
} from '../services/api';
import { RiskBadge } from './RiskBadge';
import {
  Sparkles,
  Bot,
  AlertTriangle,
  Building,
  Mail,
  Activity,
  CheckCircle2,
  TrendingDown,
  Clock,
  ArrowRight,
  ShieldAlert,
  ListOrdered,
  FileText,
  ThumbsUp
} from 'lucide-react';

interface Customer360Props {
  customerId: string;
}

export const Customer360: React.FC<Customer360Props> = ({ customerId }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [investigating, setInvestigating] = useState<boolean>(false);
  const [investigationResult, setInvestigationResult] = useState<FullAgentInvestigationResponse | null>(null);
  const [approving, setApproving] = useState<boolean>(false);
  const [approvedInterventionId, setApprovedInterventionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        setLoading(true);
        setError(null);
        setInvestigationResult(null);
        setApprovedInterventionId(null);

        const [cust, timelineData, riskResp] = await Promise.all([
          getCustomerById(customerId),
          getCustomerTimeline(customerId, 60).catch(() => []),
          getCustomerRisk(customerId).catch(() => null)
        ]);

        setCustomer(cust);
        setTimeline(timelineData);
        setRiskData(riskResp);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch customer 360 data');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [customerId]);

  const handleRunInvestigation = async () => {
    try {
      setInvestigating(true);
      setError(null);
      const result = await runInvestigation(customerId);
      setInvestigationResult(result);
      
      // Refresh risk and timeline
      const updatedRisk = await getCustomerRisk(customerId).catch(() => null);
      const updatedTimeline = await getCustomerTimeline(customerId, 60).catch(() => []);
      setRiskData(updatedRisk);
      setTimeline(updatedTimeline);
    } catch (err: any) {
      setError(err.message || 'Agent Investigation failed');
    } finally {
      setInvestigating(false);
    }
  };

  const handleApproveAction = async () => {
    const invId = investigationResult?.intervention_id;
    if (!invId) return;
    try {
      setApproving(true);
      await approveIntervention(invId, customer?.csm_name || "CSM");
      setApprovedInterventionId(invId);
    } catch (err: any) {
      setError(err.message || 'Failed to approve intervention');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Retrieving Customer 360 Telemetry & Timeline for {customerId}...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400">
        Customer context not found. Select an account from the Command Center.
      </div>
    );
  }

  const currentRiskLevel = riskData?.risk_level || (Array.isArray(riskData) && riskData[0]?.risk_level) || 'HEALTHY';
  const healthScore = riskData?.health_score ?? (riskData?.risk_score ? 100 - riskData.risk_score : 85);
  const rootCauseText = riskData?.primary_root_cause || riskData?.root_cause || (Array.isArray(riskData) && riskData[0]?.root_cause) || 'No severe risk detected';
  const reasoningText = riskData?.reasoning_summary || (Array.isArray(riskData) && riskData[0]?.reasoning_summary) || 'Telemetry within nominal ranges.';

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{customer.name}</h1>
            <RiskBadge level={currentRiskLevel} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
            <span className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5 text-slate-500" /> {customer.domain}</span>
            <span>·</span>
            <span>Industry: {customer.industry}</span>
            <span>·</span>
            <span>Plan: <strong className="text-slate-200">{customer.plan}</strong></span>
            <span>·</span>
            <span>ARR: <strong className="text-emerald-400">${customer.arr.toLocaleString()}</strong></span>
          </div>
        </div>

        <button
          onClick={handleRunInvestigation}
          disabled={investigating}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all shadow-lg shadow-indigo-950/50 disabled:opacity-50"
        >
          {investigating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Agent Investigating Telemetry...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>Run AI Investigation</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Health Metrics & Profile */}
        <div className="space-y-6 lg:col-span-1">
          {/* Health Score Overview */}
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Deterministic Risk Engine</span>
            </h3>

            <div className="space-y-4">
              <div className="flex items-end justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs text-slate-400">Health Index</div>
                  <div className="text-3xl font-extrabold text-slate-100 mt-0.5">
                    {Math.round(healthScore)} <span className="text-xs font-normal text-slate-500">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Risk Assessment</div>
                  <div className="text-xs font-semibold text-rose-400 mt-1 flex items-center justify-end gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {currentRiskLevel}
                  </div>
                </div>
              </div>

              {/* Primary Root Cause */}
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Primary Root Cause</span>
                <p className="font-semibold text-slate-200">{rootCauseText}</p>
                <p className="text-slate-400 text-[11px] leading-relaxed">{reasoningText}</p>
              </div>
            </div>
          </div>

          {/* Account Metadata Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Account Ownership</h3>
            <div className="text-xs space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">CSM Manager:</span>
                <span className="font-medium">{customer.csm_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CSM Email:</span>
                <span className="font-mono text-indigo-400">{customer.csm_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lifecycle Stage:</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px]">{customer.lifecycle_stage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contract Renewal:</span>
                <span className="font-mono text-slate-300">{customer.renewal_date}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Investigation & Timeline */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* AI Investigation Output Card */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-900/40 p-6 rounded-xl shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-950 rounded-lg border border-indigo-800/50">
                  <Bot className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">Autonomous Investigation Agent Output</h2>
                  <p className="text-xs text-slate-400">Root Cause Synthesis, Evidence Grounding & Action Plan</p>
                </div>
              </div>
              {investigationResult && (
                <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2.5 py-1 rounded-full font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Investigation Active
                </span>
              )}
            </div>

            {investigationResult ? (
              <div className="space-y-5">
                {/* Root Cause & Confidence */}
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" /> Root Cause Diagnosed
                    </div>
                    <span className="text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded">
                      Confidence: {(investigationResult.investigation.confidence * 100).toFixed(0)}% ({investigationResult.investigation.uncertainty_status})
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-100">
                    {investigationResult.investigation.root_cause}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {investigationResult.investigation.summary}
                  </p>
                </div>

                {/* Grounding Evidence Citation IDs */}
                {investigationResult.investigation.evidence_ids && investigationResult.investigation.evidence_ids.length > 0 && (
                  <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-lg text-xs space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" /> Evidence Grounding Citations
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {investigationResult.investigation.evidence_ids.map((evId) => (
                        <span key={evId} className="bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded">
                          {evId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Retention Action Plan & Steps */}
                {investigationResult.retention_plan && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ListOrdered className="w-4 h-4 text-violet-400" /> Recommended Action Plan
                      </div>
                      
                      {approvedInterventionId ? (
                        <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Plan Approved
                        </span>
                      ) : (
                        <button
                          onClick={handleApproveAction}
                          disabled={approving}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-950"
                        >
                          {approving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ThumbsUp className="w-3.5 h-3.5" />
                          )}
                          <span>Approve Intervention Plan</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {investigationResult.retention_plan.plan_steps?.map((step: any, idx: number) => (
                        <div key={idx} className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-start gap-3">
                          <span className="flex items-center justify-center w-5 h-5 bg-indigo-950 border border-indigo-800 text-indigo-400 rounded-full text-xs font-bold shrink-0 mt-0.5">
                            {step.step || idx + 1}
                          </span>
                          <div className="flex-1 text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-200">{step.title}</span>
                              <span className="text-[11px] text-slate-500 font-mono">Owner: {step.owner}</span>
                            </div>
                            <p className="text-slate-400">{step.action}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Draft Email Card */}
                    {investigationResult.retention_plan.draft_email && (
                      <div className="mt-4 bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                        <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="w-4 h-4" /> Generated Outreach Email
                        </div>
                        <div className="text-xs font-medium text-slate-200 border-b border-slate-800 pb-1">
                          Subject: {investigationResult.retention_plan.draft_email.subject}
                        </div>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed pt-1">
                          {investigationResult.retention_plan.draft_email.body}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Current Status</div>
                  <div className="text-sm font-semibold text-slate-200">{rootCauseText}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{reasoningText}</p>
                </div>
                <div className="p-4 bg-indigo-950/30 border border-indigo-800/30 rounded-lg text-xs text-indigo-300 flex items-center justify-between">
                  <span>Click "Run AI Investigation" above to execute the multi-agent investigation workflow.</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </div>
              </div>
            )}
          </div>

          {/* Unified Customer Timeline */}
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Unified Customer Timeline ({timeline.length} Events)</span>
            </h3>

            {timeline.length === 0 ? (
              <div className="text-slate-500 text-xs py-4 text-center">No timeline telemetry records found for this period.</div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800 pl-8 max-h-96 overflow-y-auto pr-2">
                {timeline.map((evt) => (
                  <div key={evt.id} className="relative bg-slate-950/80 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                    <div className="absolute -left-8 top-3.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-900" />
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="font-mono text-[11px]">{new Date(evt.timestamp).toLocaleString()}</span>
                      <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono uppercase text-slate-300">
                        {evt.source}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-200">{evt.title}</div>
                    {evt.description && <p className="text-slate-400 line-clamp-2">{evt.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
