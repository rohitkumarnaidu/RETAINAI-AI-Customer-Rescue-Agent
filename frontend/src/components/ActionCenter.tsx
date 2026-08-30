// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  ExperienceMemory,
  Intervention,
  getExperienceMemories,
  getAllInterventions,
  getAllOutcomes
} from '../services/api';
import {
  Brain,
  Zap,
  AlertTriangle
} from 'lucide-react';

export const ActionCenter: React.FC = () => {
  const [memories, setMemories] = useState<ExperienceMemory[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'memory' | 'interventions'>('memory');

  const getPlanSteps = (iv:any):any[]=>{
    if(Array.isArray(iv?.plan_steps)) return iv.plan_steps;
    if(Array.isArray(iv?.steps)) return iv.steps as any[];
    const raw = iv?.plan ?? iv?.plan_steps ?? iv?.steps;
    if(typeof raw==='string'){
      try{ const p=JSON.parse(raw); return Array.isArray(p)?p:[]; }catch{ return []; }
    }
    if(Array.isArray(raw)) return raw;
    return [];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [memData, intData, outData] = await Promise.all([
          getExperienceMemories().catch(() => []),
          getAllInterventions().catch(() => []),
          getAllOutcomes().catch(() => []),
        ]);
        setMemories(memData as any);
        setInterventions(intData as any);
        setOutcomes(Array.isArray(outData)?outData:[]);
      } catch (err: any) {
        setError(err.message || 'Failed to load Action Center telemetry');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading Learning Loop & Experience Memory Bank...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-100">Action Center & Learning Loop</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Closed-loop intelligence engine that learns from historical interventions and validates (+delta) outcome recovery.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('memory')}
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'memory'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Experience Memory ({memories.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('interventions')}
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'interventions'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Recorded Plans ({interventions.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Experience Memory Bank */}
      {activeTab === 'memory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memories.length === 0 ? (
              <div className="col-span-2 p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                No experience memory entries committed yet. Execute investigations and record successful outcomes to build organizational intelligence.
              </div>
            ) : (
              memories.map((mem) => (
                <div
                  key={mem.id}
                  className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/40">
                        {mem.industry_segment || (mem as any).customer_segment || 'Enterprise'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100 mt-2">{mem.root_cause_category || (mem as any).risk_pattern}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Success Rate</div>
                      <div className="text-lg font-extrabold text-emerald-400 font-mono">
                        {(() => {
                          const anyMem = mem as any;
                          if (typeof anyMem.success_rate === 'number') return (anyMem.success_rate * 100).toFixed(0) + '%';
                          const total = (anyMem.success_count ?? 0) + (anyMem.failure_count ?? 0);
                          if (total > 0) return ((anyMem.success_count / total) * 100).toFixed(0) + '%';
                          if (typeof anyMem.confidence === 'number') return (anyMem.confidence * 100).toFixed(0) + '%';
                          return '—';
                        })()}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/50">
                    "{mem.key_insights || (mem as any).observed_outcome || (mem as any).recommended_strategy}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/60 pt-2">
                    <span>Action Type: <strong className="text-slate-300">{mem.intervention_type || (mem as any).recommended_strategy || 'RECOVERY'}</strong></span>
                    <span>Sample Size: <strong className="text-slate-300">{(mem as any).success_count ?? mem.sample_size ?? 1} accounts</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Recorded Plans & Outcomes */}
      {activeTab === 'interventions' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-100">Active & Historical Interventions</h3>
            <span className="text-xs text-slate-400">{interventions.length} Plans Created</span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {interventions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active intervention plans found in database.
              </div>
            ) : (
              interventions.map((plan) => (
                <div key={plan.id} className="p-4 hover:bg-slate-800/20 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-200">{plan.title}</span>
                      <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono">
                        {plan.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{plan.objective}</p>

                  {/* Steps count & Draft Email preview */}
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span>Steps: {getPlanSteps(plan).length}</span>
                    <span>·</span>
                    <span>Priority: <strong className="text-amber-400">{plan.priority}</strong></span>
                    <span>·</span>
                    <span>Customer ID: <strong className="text-indigo-400">{plan.customer_id}</strong></span>
                    {outcomes.find((o:any)=>o.intervention_id===plan.id) && <span className="ml-2 text-emerald-400">· Outcome Δ {outcomes.find((o:any)=>o.intervention_id===plan.id)?.health_delta}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
