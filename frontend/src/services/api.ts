import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface Customer {
  id: string; name: string; domain: string; segment: string; industry: string; plan: string;
  arr: number; mrr?: number; csm_name: string; csm_email: string; start_date: string; renewal_date: string;
  lifecycle_stage: string; status?: string; health_score: number; risk_level: string;
  is_false_positive_candidate?: boolean; created_at: string;
}
export interface RiskAssessment { id:string; customer_id:string; timestamp:string; risk_level:string; risk_score:number; confidence:number; trend:string; delta_points:number; root_cause:string; reasoning_summary:string; alternative_explanations:string[]; evidence_ids:string[]; contributing_factors:Record<string,number>; }
export interface InterventionStep { step:number; title:string; owner:string; action:string; target_date:string; }
export interface DraftEmail { recipient_name:string; recipient_role:string; subject:string; body:string; }
export interface RetentionPlan { objective:string; priority:string; root_cause:string; steps:InterventionStep[]; draft_email:DraftEmail; }
export interface InvestigationResult { status:string; assessment:RiskAssessment; plan:RetentionPlan; }
export interface Intervention { id:string; customer_id:string; investigation_id?:string; recommendation_id?:string; created_at:string; status:string; action_type:string; title:string; description?:string; objective?:string; priority:string; plan?:string; plan_steps?:InterventionStep[]; draft_email?:DraftEmail; evidence_ids?:string[]; requires_approval?:boolean; approved_by?:string; }
export interface InterventionOutcome { id:string; intervention_id:string; customer_id?:string; created_at:string; evaluated_at?:string; status:string; health_before:number; health_after:number; health_delta:number; usage_before?:number; usage_after?:number; customer_response?:string; notes?:string; confidence?:number; evaluation_status?:string; }
export interface ExperienceMemory { id:string; industry_segment?:string; customer_segment?:string; root_cause_category?:string; pattern?:string; context_pattern?:string; risk_pattern?:string; intervention_type?:string; recommended_strategy?:string; actual_action?:string; observed_outcome?:string; key_insights?:string; sample_size:number; successful_outcomes?:number; success_count?:number; failure_count?:number; success_rate:number; confidence:number; last_updated?:string; last_observed?:string; validation_status?:string; status?:string; signals?:string[]; }
export interface TimelineEvent { id:string; timestamp:string; type?:string; event_type?:string; title:string; description?:string; source:string; severity?:string; details?:Record<string,any>; }
export interface Signal { id:string; signal_type:string; severity:string; description:string; detected_at:string; }
export interface RiskAssessmentResponse { customer_id:string; health_score:number; risk_score:number; risk_level:string; primary_root_cause?:string; reasoning_summary?:string; contributing_factors?:Record<string,number>; delta_points?:number; trend?:string; health_components?:Record<string,number>; confidence?:number; signals?:string[]; evidence_ids?:string[]; }
export interface FullAgentInvestigationResponse { run_id:string; customer_id:string; health_dimensions:Record<string,number>; risk_assessment:Record<string,any>; investigation:{ summary:string; root_cause:string; confidence:any; uncertainty_status:string; evidence_ids:string[]; recommended_action_summary:string; missing_evidence:string[]; }; retention_plan:{ objective:string; priority:string; action_type:string; title:string; description:string; plan_steps:InterventionStep[]; draft_email?:DraftEmail; }; intervention_id:string; structured_output?:any; state_history?:any[]; }

export const getCustomers = async (): Promise<Customer[]> => { const r=await api.get<Customer[]>('/customers'); return r.data; };
export const getCustomer = async (id:string): Promise<Customer> => { const r=await api.get<Customer>(`/customers/${id}`); return r.data; };
export const getCustomerById = getCustomer;
export const getCustomerTimeline = async (id:string, days=60): Promise<TimelineEvent[]> => { const r=await api.get<TimelineEvent[]>(`/customers/${id}/timeline?days=${days}`); return r.data; };
export const getCustomerRisk = async (id:string): Promise<any> => { const r=await api.get<any>(`/customers/${id}/risk`); return r.data; };
export const getCustomerSignals = async (id:string): Promise<Signal[]> => { const r=await api.get<Signal[]>(`/customers/${id}/signals`); return r.data; };
export const runInvestigation = async (id:string): Promise<FullAgentInvestigationResponse> => { const r=await api.post<FullAgentInvestigationResponse>(`/agent/investigate/${id}`); return r.data; };
export const getInvestigation = async (runIdOrCustomerId:string): Promise<any> => { const r=await api.get<any>(`/agent/runs/${runIdOrCustomerId}`); return r.data; };
export const getAgentRuns = async (customerId:string): Promise<any[]> => { const r=await api.get<any[]>(`/agent/runs/${customerId}`); return r.data; };
export const getAgentRunDetail = async (runId:string): Promise<any> => { const r=await api.get<any>(`/agent-runs/${runId}`); return r.data; };
export const approveIntervention = async (interventionId:string, approvedBy="CSM"): Promise<Intervention> => { const r=await api.post<Intervention>(`/interventions/${interventionId}/approve?approved_by=${encodeURIComponent(approvedBy)}`); return r.data; };
export const rejectIntervention = async (interventionId:string, reason="No reason", actor="CSM"): Promise<Intervention> => { const r=await api.post<Intervention>(`/interventions/${interventionId}/reject?reason=${encodeURIComponent(reason)}&actor=${encodeURIComponent(actor)}`); return r.data; };
export const resetDemo = async (): Promise<{status:string;message:string}> => { const r=await api.post<{status:string;message:string}>('/system/reset'); return r.data; };
export const getCustomerInterventions = async (id:string): Promise<Intervention[]> => { const r=await api.get<Intervention[]>(`/customers/${id}/interventions`); return r.data; };
export const getCustomerEvidence = async (id:string): Promise<any[]> => { const r=await api.get<any[]>(`/customers/${id}/evidence`); return r.data; };
export const resolveEvidence = async (evidenceId:string): Promise<any> => { const r=await api.get<any>(`/evidence/${evidenceId}`); return r.data; };
export const getCustomerMemory = async (id:string): Promise<any[]> => { const r=await api.get<any[]>(`/customers/${id}/memory`); return r.data; };
export const getExperienceMemories = async (): Promise<ExperienceMemory[]> => { try{ const r=await api.get<ExperienceMemory[]>('/learning/memories'); return r.data;} catch{ const r=await api.get<ExperienceMemory[]>('/experience-memory'); return r.data; } };
export const getLearningOverview = async (): Promise<any> => { const r=await api.get<any>('/learning'); return r.data; };
export const getAllInterventions = async (): Promise<Intervention[]> => { const r=await api.get<Intervention[]>('/interventions'); if(r.data?.length) return r.data; try{ const customers=await getCustomers(); const all:Intervention[]=[]; for(const c of customers){ try{ const per=await getCustomerInterventions(c.id); all.push(...per);}catch{}} return all.length? all: r.data;} catch{ return r.data; } };
export const getAllOutcomes = async (): Promise<InterventionOutcome[]> => { const r=await api.get<InterventionOutcome[]>('/outcomes'); return r.data; };
export const getPortfolio = async (): Promise<{metrics:any;customers:Customer[]}> => { const r=await api.get('/portfolio'); return r.data; };
export const getObservability = async (): Promise<any> => { const r=await api.get('/metrics/observability'); return r.data; };
