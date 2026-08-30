import { useState, useEffect } from 'react';
import { CommandCenter } from './components/CommandCenter';
import { Customer360 } from './components/Customer360';
import { CustomersView } from './components/CustomersView';
import { InvestigationsView } from './components/InvestigationsView';
import { InterventionsView } from './components/InterventionsView';
import { LearningView } from './components/LearningView';
import { AuditView } from './components/AuditView';
import { resetDemo } from './services/api';
import { LayoutDashboard, Users, UserCircle2, SearchCode, ClipboardList, GraduationCap, ScrollText, Shield, RefreshCw, Menu, X, FlaskConical } from 'lucide-react';

type Tab = 'command'|'customers'|'customer360'|'investigations'|'interventions'|'learning'|'audit';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('command');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('acme-corp-001');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),60000); return ()=>clearInterval(id)},[]);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customer360');
    setMobileNavOpen(false);
    window.scrollTo({top:0, behavior:'smooth'});
  };

  const handleResetDemo = async () => {
    try {
      setResetting(true);
      const res = await resetDemo();
      setToast(res.message || "Database reset — 101 accounts restored");
      setTimeout(()=> window.location.reload(), 900);
    } catch {
      setToast("Reset failed — run `python -m retainai.scripts.seed_database` in backend");
      setTimeout(()=> setToast(null), 3000);
    } finally { setResetting(false); }
  };

  const navItems: {id:Tab,label:string,icon:any,desc:string}[] = [
    {id:'command', label:'Command Center', icon:LayoutDashboard, desc:'What needs attention'},
    {id:'customers', label:'Customers', icon:Users, desc:'Portfolio & filters'},
    {id:'customer360', label:'Customer 360', icon:UserCircle2, desc:'Investigation workspace'},
    {id:'investigations', label:'Investigations', icon:SearchCode, desc:'Agent runs & evidence'},
    {id:'interventions', label:'Interventions', icon:ClipboardList, desc:'Plans & outcomes'},
    {id:'learning', label:'Learning', icon:GraduationCap, desc:'Experience memory'},
    {id:'audit', label:'Activity', icon:ScrollText, desc:'Audit trail'},
  ];

  return (
    <div className="min-h-screen bg-[#F8F7F5] text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      <div className="bg-[#0F172A] text-slate-300 text-[11px] font-mono tracking-wide">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-7 flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Demo environment · Synthetic customer data · 101 accounts · SENSE → THINK → ACT → MEASURE → LEARN
          </span>
          <span className="hidden md:inline text-slate-400">Updated {now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · Monitoring active</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={()=>setMobileNavOpen(v=>!v)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100" aria-label="Toggle navigation">
              {mobileNavOpen ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
            </button>
            <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[15px] tracking-tight">RETAIN<span className="font-normal text-slate-500">AI</span></span>
                <span className="hidden sm:inline text-[10px] border border-slate-200 bg-slate-50 px-1.5 py-0.5 rounded font-mono text-slate-600">AUTONOMOUS ENGINE v1.0</span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 -mt-0.5">Customer retention intelligence — closed-loop system</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-slate-500 border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded-lg">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Acme Corp · Hero scenario</span>
              <button onClick={()=>handleSelectCustomer('acme-corp-001')} className="ml-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 hover:bg-slate-50">Open</button>
            </div>
            <button onClick={handleResetDemo} disabled={resetting} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${resetting? 'animate-spin':''}`} /> <span className="hidden sm:inline">Reset demo</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex gap-6">
        <aside className="hidden lg:block w-[220px] shrink-0 sticky top-[88px] h-fit">
          <nav className="space-y-1">
            {navItems.map(item=>{
              const Active = item.icon;
              const active = activeTab===item.id;
              return (
                <button
                  key={item.id}
                  onClick={()=>setActiveTab(item.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200 hover:shadow-sm'}`}
                >
                  <Active className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span className="flex-1">
                    <span className={`block leading-none ${active? 'font-semibold':'font-medium'}`}>{item.label}</span>
                    <span className={`block text-[11px] leading-none mt-1 ${active? 'text-slate-300':'text-slate-400'}`}>{item.desc}</span>
                  </span>
                </button>
              )
            })}
          </nav>
          <div className="mt-6 bg-white border border-slate-200 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-slate-900">How RETAINAI works</div>
            <div className="mt-2 text-[11px] leading-relaxed text-slate-600 font-mono">
              SENSE → THINK → ACT → MEASURE → LEARN
            </div>
            <div className="mt-2 text-xs text-slate-600 leading-relaxed">
              Detects meaningful change, investigates with evidence, recommends next-best action, measures outcome, learns.
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 font-mono px-1">© 2026 RETAINAI · BuildSprint</div>
        </aside>

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-30 bg-black/20" onClick={()=>setMobileNavOpen(false)}>
            <div onClick={e=>e.stopPropagation()} className="w-[280px] h-full bg-white border-r border-slate-200 p-4 overflow-auto">
              <nav className="space-y-1">
                {navItems.map(item=>{
                  const Icon=item.icon; const active=activeTab===item.id;
                  return <button key={item.id} onClick={()=>{setActiveTab(item.id); setMobileNavOpen(false)}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active? 'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4"/>{item.label}</button>
                })}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0">
          {toast && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 rounded-lg">{toast}</div>}
          {activeTab==='command' && <CommandCenter onSelectCustomer={handleSelectCustomer} />}
          {activeTab==='customers' && <CustomersView onSelectCustomer={handleSelectCustomer} />}
          {activeTab==='customer360' && <Customer360 customerId={selectedCustomerId} />}
          {activeTab==='investigations' && <InvestigationsView onSelectCustomer={handleSelectCustomer} />}
          {activeTab==='interventions' && <InterventionsView />}
          {activeTab==='learning' && <LearningView />}
          {activeTab==='audit' && <AuditView />}
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-mono">
          <span>RETAINAI · Evidence-based retention · No fabricated certainty</span>
          <span>Loop: SENSE → THINK → ACT → MEASURE → LEARN → REPEAT</span>
        </div>
      </footer>
    </div>
  );
}
export default App;
