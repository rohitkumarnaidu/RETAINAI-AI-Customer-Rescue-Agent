import React, { useEffect, useState } from 'react';
import { Sliders, Key, FileText, Save, RefreshCw, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, SectionHeader } from './ui';
import { api } from '../services/api';

interface OrgSettings {
  tenant_id: string;
  health_weights: Record<string, number>;
  risk_thresholds: Record<string, number>;
  llm_provider: string;
  llm_model: string;
  has_llm_key: boolean;
  investigation_prompt: string | null;
  action_prompt: string | null;
  updated_at?: string;
}

const DEFAULT_WEIGHTS = { usage: 0.4, support: 0.3, sentiment: 0.2, engagement: 0.1 };
const DEFAULT_THRESHOLDS = { critical: 20, high: 40, at_risk: 60, watch: 80, healthy: 90 };

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // form state
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<Record<string, number>>(DEFAULT_THRESHOLDS);
  const [llmProvider, setLlmProvider] = useState('groq');
  const [llmModel, setLlmModel] = useState('openai/gpt-oss-120b');
  const [llmKey, setLlmKey] = useState('');
  const [invPrompt, setInvPrompt] = useState('');
  const [actPrompt, setActPrompt] = useState('');

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const r = await api.get<OrgSettings>('/org/settings');
      const data = r.data;
      setSettings(data);
      setWeights(data.health_weights || DEFAULT_WEIGHTS);
      setThresholds(data.risk_thresholds || DEFAULT_THRESHOLDS);
      setLlmProvider(data.llm_provider || 'groq');
      setLlmModel(data.llm_model || 'openai/gpt-oss-120b');
      setInvPrompt(data.investigation_prompt || '');
      setActPrompt(data.action_prompt || '');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || 'Failed to load settings');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const sumWeights = Object.values(weights).reduce((a, b) => a + Number(b || 0), 0);
  const sumOk = Math.abs(sumWeights - 1.0) < 0.01;

  const normalize = () => {
    const sum = sumWeights || 1;
    const norm: Record<string, number> = {};
    (Object.keys(weights) as (keyof typeof weights)[]).forEach(k => {
      norm[k] = Math.round((weights[k] / sum) * 100) / 100;
    });
    // fix rounding drift
    const drift = 1 - Object.values(norm).reduce((a, b) => a + b, 0);
    const first = Object.keys(norm)[0];
    if (first) norm[first] = Math.round((norm[first] + drift) * 100) / 100;
    setWeights(norm);
  };

  const handleSave = async () => {
    setSaving(true); setError(null); setToast(null);
    try {
      const payload: Record<string, unknown> = {
        health_weights: weights,
        risk_thresholds: thresholds,
        llm_provider: llmProvider,
        llm_model: llmModel,
        investigation_prompt: invPrompt || null,
        action_prompt: actPrompt || null,
      };
      if (llmKey.trim()) payload['llm_api_key'] = llmKey.trim();
      const r = await api.put<OrgSettings>('/org/settings', payload);
      setSettings(r.data);
      setToast('Settings saved — next reassessment & investigation will use them');
      setLlmKey('');
      setTimeout(() => setToast(null), 3000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Loading org settings…</div>;

  return (
    <div className="space-y-5 max-w-[960px]">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {toast && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 rounded-lg flex gap-2"><CheckCircle2 className="w-4 h-4" />{toast}</div>}

      <Card>
        <SectionHeader title="Organization Settings — per-tenant" subtitle={`Tenant ${settings?.tenant_id || '—'} · ${settings?.updated_at ? 'updated ' + new Date(settings.updated_at).toLocaleString() : 'defaults'} · Never exposes raw LLM key`} icon={Sliders} action={<button onClick={load} className="text-xs border border-slate-200 bg-white px-2.5 py-1.5 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" />Refresh</button>} />
        <div className="text-xs text-slate-500 mt-1">Health weights, risk thresholds, LLM BYOK, and prompts are isolated per org. Changing them bumps <code className="bg-slate-100 px-1 rounded">updated_at</code> and is captured in next <code className="bg-slate-100 px-1 rounded">AgentRun.prompt_version</code> for replay.</div>
      </Card>

      {/* Health Weights */}
      <Card>
        <SectionHeader title="Health Weights" subtitle="Weighted composite health = usage×w1 + support×w2 + sentiment×w3 + engagement×w4. Must sum ≈1.0" icon={Sliders} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(DEFAULT_WEIGHTS) as (keyof typeof DEFAULT_WEIGHTS)[]).map(k => (
            <div key={k}>
              <label className="text-xs font-semibold font-mono uppercase">{k}</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="range" min={0} max={1} step={0.05} value={weights[k] ?? 0.25} onChange={e => setWeights(w => ({ ...w, [k]: Number(e.target.value) }))} className="flex-1" />
                <input type="number" min={0} max={1} step={0.05} value={weights[k] ?? 0} onChange={e => setWeights(w => ({ ...w, [k]: Number(e.target.value) }))} className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full border font-mono ${sumOk ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>Σ = {sumWeights.toFixed(2)} {sumOk ? '✓ ok' : '→ normalize'}</span>
          <button onClick={normalize} className="border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Normalize to 1.0</button>
          <span className="text-slate-500">Default {JSON.stringify(DEFAULT_WEIGHTS)}</span>
        </div>
      </Card>

      {/* Risk Thresholds */}
      <Card>
        <SectionHeader title="Risk Thresholds" subtitle="Health→risk mapping. Must be increasing: critical < high < at_risk < watch < healthy" icon={AlertTriangle} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(Object.keys(DEFAULT_THRESHOLDS) as (keyof typeof DEFAULT_THRESHOLDS)[]).map(k => (
            <div key={k}>
              <label className="text-xs font-semibold font-mono uppercase">{k}</label>
              <input type="number" min={0} max={100} value={thresholds[k] ?? DEFAULT_THRESHOLDS[k]} onChange={e => setThresholds(t => ({ ...t, [k]: Number(e.target.value) }))} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" />
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-2">Example: health 18 → CRITICAL {"<"} 20, 42 → AT_RISK 40-60, 88 → STABLE 80-90, 95 → HEALTHY.</div>
      </Card>

      {/* LLM BYOK */}
      <Card>
        <SectionHeader title="LLM — Bring Your Own Key (per-org)" subtitle={settings?.has_llm_key ? 'Key stored (encrypted via APP_SECRET_KEY) — not displayed. Leave blank to keep.' : 'No key stored — using global mock fallback (deterministic). Add groq/openai/gemini key to enable live.'} icon={Key} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold">Provider</label>
            <select value={llmProvider} onChange={e => setLlmProvider(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white">
              <option value="groq">groq (recommended — LPU fastest)</option>
              <option value="openai">openai</option>
              <option value="gemini">gemini</option>
              <option value="mock">mock (deterministic fallback)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold">Model</label>
            <input value={llmModel} onChange={e => setLlmModel(e.target.value)} placeholder="openai/gpt-oss-120b" className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm font-mono" />
            <div className="text-[11px] text-slate-500 mt-1">{llmProvider === 'groq' ? 'Aug 2026: gpt-oss-120b ~500tps / gpt-oss-20b ~1000tps' : llmProvider === 'openai' ? 'gpt-4o / gpt-4o-mini' : 'gemini-2.5-flash / pro'}</div>
          </div>
          <div>
            <label className="text-xs font-semibold">API Key {settings?.has_llm_key ? '(••• stored)' : ''}</label>
            <input type="password" value={llmKey} onChange={e => setLlmKey(e.target.value)} placeholder={settings?.has_llm_key ? '•••••••• (leave blank to keep)' : 'gsk_... or sk-... or AIza...'} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm font-mono" />
            <div className="text-[11px] text-slate-500 mt-1">Encrypted at rest via <code className="bg-slate-100 px-1 rounded">APP_SECRET_KEY</code>. Never returned via GET.</div>
          </div>
        </div>
      </Card>

      {/* Prompts */}
      <Card>
        <SectionHeader title="System Prompts — per-org" subtitle="Override investigation / action agent prompts. Empty = use default. Max 10k chars. Bumps prompt_version." icon={FileText} />
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs font-semibold">Investigation prompt</label>
            <textarea value={invPrompt} onChange={e => setInvPrompt(e.target.value)} rows={6} placeholder="Leave blank for default forensic investigation prompt (evidence-grounded, no fabrication)" className="mt-1 w-full border border-slate-200 rounded-lg p-3 text-xs font-mono focus:outline-none focus:border-slate-400" />
            <div className="text-[11px] text-slate-500 mt-1">{invPrompt.length}/10000</div>
          </div>
          <div>
            <label className="text-xs font-semibold">Action prompt</label>
            <textarea value={actPrompt} onChange={e => setActPrompt(e.target.value)} rows={6} placeholder="Leave blank for default action strategy prompt (plan + email)" className="mt-1 w-full border border-slate-200 rounded-lg p-3 text-xs font-mono focus:outline-none focus:border-slate-400" />
            <div className="text-[11px] text-slate-500 mt-1">{actPrompt.length}/10000</div>
          </div>
        </div>
        <div className="bg-slate-900 text-slate-300 rounded-lg p-3 mt-4 text-xs">
          <div className="font-semibold text-white flex items-center gap-1.5"><Info className="w-3 h-3" />How it works</div>
          <div className="mt-1 leading-relaxed">Per-request, <code className="bg-slate-800 px-1 rounded">Orchestrator</code> loads <code className="bg-slate-800 px-1 rounded">OrgSettings</code> for <code className="bg-slate-800 px-1 rounded">tenant_id</code> → decrypts LLM key → injects prompts → <code className="bg-slate-800 px-1 rounded">LLMClient</code> per-tenant. Settings saved here affect <b>next</b> reassessment/investigation, logged as <code className="bg-slate-800 px-1 rounded">prompt_version</code>.</div>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save org settings'}</button>
        <button onClick={load} className="border border-slate-200 bg-white px-4 py-2.5 rounded-lg text-xs hover:bg-slate-50">Discard</button>
        {!sumOk && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">Weights must sum ≈1.0 to save correctly</span>}
      </div>
    </div>
  );
};
