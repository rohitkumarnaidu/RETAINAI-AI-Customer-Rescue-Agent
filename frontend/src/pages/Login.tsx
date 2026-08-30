import React, { useState } from 'react';
import { Shield, LogIn, UserPlus, AlertTriangle, Zap, Brain, Database, Cpu, Layers, GitBranch, Lock, Sparkles, ArrowRight, CheckCircle2, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC<{ onSuccess?: () => void; initialMode?: 'login' | 'signup' }> = ({ onSuccess, initialMode = 'signup' }) => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('admin@retainai.io');
  const [password, setPassword] = useState('demo123');
  const [orgName, setOrgName] = useState("Acme Demo Org");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password, orgName);
      onSuccess?.();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(ex?.response?.data?.detail || ex?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F5] flex">
      {/* Left — High Engineers + Top Models */}
      <div className="hidden lg:flex lg:w-[56%] bg-[#0F172A] text-white p-8 xl:p-10 flex-col justify-between overflow-auto">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-[#0F172A] flex items-center justify-center"><Shield className="w-5 h-5" /></div>
            <div>
              <div className="font-bold tracking-tight text-[18px]">RETAIN<span className="font-light text-slate-300">AI</span> <span className="text-[10px] border border-white/20 bg-white/10 px-1.5 py-0.5 rounded font-mono">v1.0 LIVE</span></div>
              <div className="text-xs text-slate-400 -mt-0.5">Autonomous Customer Rescue Agent · tenant-isolated</div>
            </div>
          </div>

          <div className="mt-8">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono tracking-wide border border-white/20 bg-white/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> High engineers · Top models · End-to-end
            </div>
            <h1 className="text-[28px] xl:text-[32px] font-semibold tracking-tight leading-none mt-4">
              Built by high engineers,<br />
              <span className="text-slate-300 font-normal">powered by top models.</span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed mt-3 max-w-[560px]">
              Deterministic signal engines + evidence-grounded agents. <b className="text-white">SENSE → THINK → ACT → MEASURE → LEARN → REPEAT</b> — properly, for any org, any shape, fully isolated.
            </p>
          </div>

          {/* Top Models */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-white/[0.06] border border-white/10 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center"><Cpu className="w-4 h-4 text-white" /></div>
              <div className="text-xs font-semibold mt-2">Groq LPU</div>
              <div className="text-[11px] text-slate-400 leading-tight">gpt-oss-120b ~500tps<br />gpt-oss-20b ~1000tps</div>
              <div className="text-[10px] font-mono mt-1 text-emerald-300">fastest inference</div>
            </div>
            <div className="bg-white/[0.06] border border-white/10 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center"><Brain className="w-4 h-4 text-white" /></div>
              <div className="text-xs font-semibold mt-2">OpenAI</div>
              <div className="text-[11px] text-slate-400 leading-tight">gpt-4o / gpt-4o-mini<br />o1 reasoning</div>
              <div className="text-[10px] font-mono mt-1 text-sky-300">best structured JSON</div>
            </div>
            <div className="bg-white/[0.06] border border-white/10 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
              <div className="text-xs font-semibold mt-2">Gemini</div>
              <div className="text-[11px] text-slate-400 leading-tight">2.5-flash / pro<br />1.5 fallback</div>
              <div className="text-[10px] font-mono mt-1 text-violet-300">Google scale</div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 font-mono">BYOK per tenant → `PUT /org/settings llm_api_key` (Fernet encrypted). Global `mock` fallback deterministic when no key.</div>

          {/* How it eases */}
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white text-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-1.5 font-semibold"><Zap className="w-3.5 h-3.5 text-amber-600" /> Ease for any user</div>
              <ul className="mt-2 space-y-1 text-slate-600 leading-relaxed list-disc list-inside">
                <li><b>CSV any headers</b> → Map columns `company→name`</li>
                <li><b>JSON batch</b> `POST /ingest/batch` 500</li>
                <li><b>Webhook</b> `stripe/hubspot/zendesk/segment/generic`</li>
                <li>Single form + bulk events `/events/bulk`</li>
              </ul>
            </div>
            <div className="bg-white text-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-1.5 font-semibold"><Layers className="w-3.5 h-3.5 text-emerald-600" /> Proper end-to-end</div>
              <div className="mt-2 font-mono text-[11px] leading-tight">
                <div className="flex items-center gap-1"><span className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-[10px]">1</span> SENSE <span className="text-slate-400">→ telemetry + idempotency</span></div>
                <div className="flex items-center gap-1 mt-1"><span className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-[10px]">2</span> THINK <span className="text-slate-400">→ 8 signals + health 4D</span></div>
                <div className="flex items-center gap-1 mt-1"><span className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-[10px]">3</span> ACT <span className="text-slate-400">→ evidence-grounded plan</span></div>
                <div className="flex items-center gap-1 mt-1"><span className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-[10px]">4</span> MEASURE <span className="text-slate-400">→ outcome delta 14d</span></div>
                <div className="flex items-center gap-1 mt-1"><span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">5</span> LEARN <span className="text-slate-400">→ tenant memory 2/0.70</span></div>
              </div>
            </div>
          </div>

          {/* Architecture */}
          <div className="mt-6 bg-white/[0.06] border border-white/10 rounded-xl p-3">
            <div className="text-xs font-semibold flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Architecture — why high engineers ease it</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
              <span className="bg-white text-slate-900 px-2 py-1 rounded-full border">React18 + Tailwind + axios</span>
              <span className="text-slate-500">→</span>
              <span className="bg-white text-slate-900 px-2 py-1 rounded-full border">FastAPI + SQLAlchemy async</span>
              <span className="text-slate-500">→</span>
              <span className="bg-white text-slate-900 px-2 py-1 rounded-full border">Signal/Health/Risk/TimeWindow</span>
              <span className="text-slate-500">→</span>
              <span className="bg-emerald-500 text-white px-2 py-1 rounded-full">Orchestrator 8/12/60s</span>
              <span className="text-slate-500">→</span>
              <span className="bg-white text-slate-900 px-2 py-1 rounded-full border">Chroma + Postgres/SQLite</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Tenant `X-Tenant-Id` on every table `idx_*_tenant` · `JWT tid` · `X-Request-ID` · `by_tenant` observability `GET /metrics/observability`</div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 border border-white/20 bg-white/10 px-2 py-1 rounded-full"><Lock className="w-3 h-3" /> tenant-isolated</span>
            <span className="inline-flex items-center gap-1 border border-white/20 bg-white/10 px-2 py-1 rounded-full"><Database className="w-3 h-3" /> evidence resolver</span>
            <span className="inline-flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">36/36 pytest · lint 0 · build 376kB</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono mt-6">
          RETAINAI · BuildSprint 2026 · `SENSE→THINK→ACT→MEASURE→LEARN→REPEAT` · No fabricated certainty
        </div>
      </div>

      {/* Right — Auth */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[#F8F7F5]">
        <div className="w-full max-w-[440px] bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F172A] flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div>
            <div>
              <div className="font-bold tracking-tight">RETAIN<span className="font-normal text-slate-500">AI</span> <span className="text-xs border border-slate-200 bg-slate-50 px-1.5 py-0.5 rounded font-mono">AUTH</span></div>
              <div className="text-xs text-slate-500">Tenant-isolated · JWT 24h · demo-tenant-001</div>
            </div>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> Start here — login & signup is the demo entry</div>
            <div className="text-xs text-amber-800 mt-1 leading-relaxed">High engineers made auth <b>tenant-isolated but frictionless</b>: <b>Sign up</b> creates your private workspace (any org), <b>Login</b> uses top-model-powered agents. Try `admin@retainai.io / demo123` or create your own in 3s.</div>
          </div>

          <div className="mt-4 flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setMode('login')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'login' ? 'bg-white shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}>Login</button>
            <button onClick={() => setMode('signup')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'signup' ? 'bg-white shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}>Sign up</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-xs font-semibold">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400" />
              <div className="text-[11px] text-slate-500 mt-1">Demo: <code className="bg-slate-100 px-1 rounded">admin@retainai.io / demo123</code> (also csm/viewer). Real signup creates new tenant — fully isolated.</div>
            </div>
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-semibold">Organization name</label>
                <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Corp" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
                <div className="text-[11px] text-slate-500 mt-1">Your private workspace — data, memories, BYOK never leak.</div>
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 bg-[#0F172A] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
              {loading ? 'Please wait…' : mode === 'login' ? <><LogIn className="w-4 h-4" />Login — start demo</> : <><UserPlus className="w-4 h-4" />Create org & sign up — 3s</>}
            </button>
          </form>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
              <div className="font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Login</div>
              <div className="text-slate-600 mt-1">For existing `demo-tenant-001` → `101` customers, instant investigate.</div>
              <button onClick={() => { setMode('login'); setEmail('admin@retainai.io'); setPassword('demo123'); }} className="mt-2 text-xs border border-slate-200 bg-white px-2 py-1 rounded-lg hover:bg-slate-50 w-full">Use demo admin</button>
            </div>
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
              <div className="font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3 text-violet-600" /> Sign up</div>
              <div className="text-slate-600 mt-1">New `tenant_xxx` → `0` customers → Onboarding → first investigate.</div>
              <button onClick={() => { setMode('signup'); setEmail(`user${Math.floor(Math.random()*999)}@acme.com`); }} className="mt-2 text-xs border border-slate-200 bg-white px-2 py-1 rounded-lg hover:bg-slate-50 w-full">Try fresh email</button>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500 text-center">Demo bypass still active when <code className="bg-slate-100 px-1 rounded">DEMO_MODE=true</code> — login optional for hackathon, required when <code className="bg-slate-100 px-1 rounded">AUTH_ENABLED=true</code> in prod.</div>
          <div className="mt-2 text-xs text-center flex items-center justify-center gap-2">
            <button onClick={() => { try { localStorage.setItem('retainai_bypass','1'); } catch {}; onSuccess?.(); window.location.reload(); }} className="text-slate-600 hover:text-slate-900 underline inline-flex items-center gap-1">Continue as demo (bypass) <ArrowRight className="w-3 h-3" /></button>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>End-to-end: Onboarding → 360 → Investigate → Approve → Outcome → Learn</span>
            <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 rounded">JWT 24h</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
