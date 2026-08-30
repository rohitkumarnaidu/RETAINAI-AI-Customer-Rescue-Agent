import React, { useState } from 'react';
import { Shield, LogIn, UserPlus, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC<{ onSuccess?: () => void; initialMode?: 'login' | 'signup' }> = ({ onSuccess, initialMode = 'login' }) => {
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
    <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div>
          <div>
            <div className="font-bold tracking-tight">RETAIN<span className="font-normal text-slate-500">AI</span> <span className="text-xs border border-slate-200 bg-slate-50 px-1.5 py-0.5 rounded font-mono">AUTH</span></div>
            <div className="text-xs text-slate-500">Tenant-isolated · JWT 24h · demo-tenant-001</div>
          </div>
        </div>

        <div className="mt-6 flex gap-2 p-1 bg-slate-100 rounded-xl">
          <button onClick={() => setMode('login')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'login' ? 'bg-white shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}>Login</button>
          <button onClick={() => setMode('signup')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'signup' ? 'bg-white shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-semibold">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="text-xs font-semibold">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400" />
            <div className="text-[11px] text-slate-500 mt-1">Demo: <code className="bg-slate-100 px-1 rounded">admin@retainai.io / demo123</code> (also csm/viewer). Real signup creates new tenant.</div>
          </div>
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold">Organization name</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Corp" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm" />
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
          <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 bg-[#0F172A] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
            {loading ? 'Please wait…' : mode === 'login' ? <><LogIn className="w-4 h-4" />Login</> : <><UserPlus className="w-4 h-4" />Create org & sign up</>}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-500 text-center">Demo bypass still active when <code className="bg-slate-100 px-1 rounded">DEMO_MODE=true</code> — login optional for hackathon, required when <code className="bg-slate-100 px-1 rounded">AUTH_ENABLED=true</code> in prod.</div>
        <div className="mt-3 text-xs text-center"><button onClick={() => onSuccess?.()} className="text-slate-600 hover:text-slate-900 underline">Continue as demo (bypass)</button></div>
      </div>
    </div>
  );
};

export default LoginPage;
