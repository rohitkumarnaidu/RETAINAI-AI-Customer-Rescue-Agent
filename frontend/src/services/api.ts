import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Customer {
  id: string;
  name: string;
  domain: string;
  segment: string;
  industry: string;
  plan: string;
  arr: number;
  csm_name: string;
  csm_email: string;
  start_date: string;
  renewal_date: string;
  lifecycle_stage: string;
  is_false_positive_candidate?: boolean;
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  customer_id: string;
  timestamp: string;
  risk_level: 'HEALTHY' | 'WATCH' | 'CRITICAL' | 'NEUTRAL';
  risk_score: number;
  confidence: number;
  trend: string;
  delta_points: number;
  root_cause: string;
  reasoning_summary: string;
  alternative_explanations: string[];
  evidence_ids: string[];
  contributing_factors: Record<string, number>;
}

export interface InterventionStep {
  step: number;
  title: string;
  owner: string;
  action: string;
  target_date: string;
}

export interface DraftEmail {
  recipient_name: string;
  recipient_role: string;
  subject: string;
  body: string;
}

export interface RetentionPlan {
  objective: string;
  priority: string;
  root_cause: string;
  steps: InterventionStep[];
  draft_email: DraftEmail;
}

export interface InvestigationResult {
  status: string;
  assessment: RiskAssessment;
  plan: RetentionPlan;
}

export interface Intervention {
  id: string;
  customer_id: string;
  risk_assessment_id: string;
  created_at: string;
  status: string;
  action_type: string;
  title: string;
  objective: string;
  priority: string;
  plan_steps: InterventionStep[];
  draft_email: DraftEmail;
  csm_feedback_reason?: string;
}

export interface InterventionOutcome {
  id: string;
  intervention_id: string;
  evaluated_at: string;
  status: string;
  usage_delta_pct: number;
  support_tickets_resolved: number;
  sentiment_delta_score: number;
  health_delta_score: number;
  evaluation_summary: string;
}

export interface ExperienceMemory {
  id: string;
  industry_segment: string;
  root_cause_category: string;
  intervention_type: string;
  sample_size: number;
  successful_outcomes: number;
  success_rate: number;
  key_insights: string;
  confidence: number;
  last_updated: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description?: string;
  source: string;
  severity?: string;
  details?: Record<string, any>;
}

export interface Signal {
  id: string;
  signal_type: string;
  severity: string;
  description: string;
  detected_at: string;
}

export interface RiskAssessmentResponse {
  customer_id: string;
  health_score: number;
  risk_score: number;
  risk_level: string;
  primary_root_cause: string;
  reasoning_summary: string;
  contributing_factors?: Record<string, number>;
  delta_points?: number;
  trend?: string;
}

export interface FullAgentInvestigationResponse {
  run_id: string;
  customer_id: string;
  health_dimensions: Record<string, number>;
  risk_assessment: Record<string, any>;
  investigation: {
    summary: string;
    root_cause: string;
    confidence: number;
    uncertainty_status: string;
    evidence_ids: string[];
    recommended_action_summary: string;
    missing_evidence: string[];
  };
  retention_plan: {
    objective: string;
    priority: string;
    action_type: string;
    title: string;
    description: string;
    plan_steps: InterventionStep[];
    draft_email?: DraftEmail;
  };
  intervention_id: string;
}

// API Functions
export const getCustomers = async (): Promise<Customer[]> => {
  const response = await api.get<Customer[]>('/customers');
  return response.data;
};

export const getCustomer = async (id: string): Promise<Customer> => {
  const response = await api.get<Customer>(`/customers/${id}`);
  return response.data;
};

export const getCustomerById = getCustomer;

export const getCustomerTimeline = async (id: string, days: number = 60): Promise<TimelineEvent[]> => {
  const response = await api.get<TimelineEvent[]>(`/customers/${id}/timeline?days=${days}`);
  return response.data;
};

export const getCustomerRisk = async (id: string): Promise<RiskAssessmentResponse | RiskAssessment[]> => {
  const response = await api.get<any>(`/customers/${id}/risk`);
  return response.data;
};

export const getCustomerSignals = async (id: string): Promise<Signal[]> => {
  const response = await api.get<Signal[]>(`/customers/${id}/signals`);
  return response.data;
};

export const runInvestigation = async (id: string): Promise<FullAgentInvestigationResponse> => {
  const response = await api.post<FullAgentInvestigationResponse>(`/agent/investigate/${id}`);
  return response.data;
};

export const getInvestigation = async (runIdOrCustomerId: string): Promise<any> => {
  const response = await api.get<any>(`/agent/runs/${runIdOrCustomerId}`);
  return response.data;
};

export const approveIntervention = async (interventionId: string, approvedBy: string = "CSM"): Promise<Intervention> => {
  const response = await api.post<Intervention>(`/interventions/${interventionId}/approve?approved_by=${encodeURIComponent(approvedBy)}`);
  return response.data;
};

export const resetDemo = async (): Promise<{ status: string; message: string }> => {
  const response = await api.post<{ status: string; message: string }>('/system/reset');
  return response.data;
};

export const getCustomerInterventions = async (id: string): Promise<Intervention[]> => {
  const response = await api.get<Intervention[]>(`/customers/${id}/interventions`);
  return response.data;
};

export const triggerInvestigation = async (id: string): Promise<InvestigationResult> => {
  const response = await api.post<InvestigationResult>(`/agent/investigate/${id}`);
  return response.data;
};

export const getExperienceMemories = async (): Promise<ExperienceMemory[]> => {
  try {
    const response = await api.get<ExperienceMemory[]>('/learning/memories');
    return response.data;
  } catch {
    const response = await api.get<ExperienceMemory[]>('/experience-memory');
    return response.data;
  }
};

export const getAllInterventions = async (): Promise<Intervention[]> => {
  const response = await api.get<Intervention[]>('/interventions');
  if (response.data && response.data.length > 0) return response.data;
  // fallback: aggregate per-customer if empty (legacy backend)
  try {
    const customers = await getCustomers();
    const all: Intervention[] = [];
    for (const c of customers) {
      try {
        const per = await getCustomerInterventions(c.id);
        all.push(...per);
      } catch {
        // ignore per-customer fetch errors
      }
    }
    return all.length > 0 ? all : response.data;
  } catch {
    return response.data;
  }
};

export const getPortfolio = async (): Promise<{ metrics: any; customers: Customer[] }> => {
  const response = await api.get('/portfolio');
  return response.data;
};

export const getAllOutcomes = async (): Promise<InterventionOutcome[]> => {
  const response = await api.get<InterventionOutcome[]>('/outcomes');
  return response.data;
};
