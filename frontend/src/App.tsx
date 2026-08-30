import { useState } from 'react';
import { CommandCenter } from './components/CommandCenter';
import { Customer360 } from './components/Customer360';
import { ActionCenter } from './components/ActionCenter';
import { resetDemo } from './services/api';
import { LayoutDashboard, Users, Brain, Shield, RefreshCw } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'command' | 'customer360' | 'actions'>('command');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('acme-corp-001');
  const [resetting, setResetting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customer360');
  };

  const handleResetDemo = async () => {
    try {
      setResetting(true);
      setResetMessage(null);
      const res = await resetDemo();
      setResetMessage(res.message || "Database reset successfully!");
      // Reload current view after 1s
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      alert("Reset endpoint failed or unreached. Please run `uv run python -m retainai.scripts.seed_database` in backend.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-950">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white font-mono">RETAIN<span className="text-indigo-400">AI</span></span>
                <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800/50 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  v1.0 Autonomous Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Closed-Loop AI Customer Success & Retention Command Center</p>
            </div>
          </div>

          {/* Tab Navigation & Reset Demo Button */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 bg-slate-900/90 p-1 border border-slate-800/80 rounded-xl">
              <button
                onClick={() => setActiveTab('command')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'command'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Command Center</span>
              </button>

              <button
                onClick={() => setActiveTab('customer360')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'customer360'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Customer 360</span>
              </button>

              <button
                onClick={() => setActiveTab('actions')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'actions'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Action & Learning</span>
              </button>
            </nav>

            <button
              onClick={handleResetDemo}
              disabled={resetting}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              title="Reset Database to 101 Hybrid Dataset Seed Accounts"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${resetting ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Reset Demo</span>
            </button>
          </div>
        </div>
      </header>

      {resetMessage && (
        <div className="bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-300 text-xs py-2 px-4 text-center font-mono animate-fade-in">
          {resetMessage} (Reloading application...)
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'command' && <CommandCenter onSelectCustomer={handleSelectCustomer} />}
        {activeTab === 'customer360' && <Customer360 customerId={selectedCustomerId} />}
        {activeTab === 'actions' && <ActionCenter />}
      </main>

      {/* Footer / System Status Bar */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>FastAPI Backend Connected: http://localhost:8000</span>
          </div>
          <div>Loop Protocol: SENSE → THINK → ACT → MEASURE → LEARN</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
