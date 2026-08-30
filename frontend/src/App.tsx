import { useState, useEffect } from 'react';
import { CommandCenter } from './components/CommandCenter';
import { Customer360 } from './components/Customer360';
import { CustomersView } from './components/CustomersView';
import { InvestigationsView } from './components/InvestigationsView';
import { InterventionsView } from './components/InterventionsView';
import { LearningView } from './components/LearningView';
import { AuditView } from './components/AuditView';
import { Onboarding } from './components/Onboarding';
import { SettingsView } from './components/SettingsView';
import { AnalyticsView } from './components/AnalyticsView';
import { DataHubView } from './components/DataHubView';
import { LoginPage } from './pages/Login';
import { useAuth } from './context/AuthContext';
import { resetDemo, getCustomers } from './services/api';
import { ChatWidget } from './components/ChatWidget';
import { LayoutDashboard, Users, UserCircle2, SearchCode, ClipboardList, GraduationCap, ScrollText, Shield, RefreshCw, Menu, X, Upload, Settings, LogOut, LogIn, BarChart3, Database, MessageCircle } from 'lucide-react';
import { ChatView } from './components/ChatView';

type Tab = 'command'|'customers'|'customer360'|'investigations'|'interventions'|'learning'|'audit'|'onboarding'|'settings'|'analytics'|'datahub'|'chat';

export function App() {
  const { user, tenantId, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('command');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [customersImportOpen,setCustomersImportOpen]=useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [hasCustomers, setHasCustomers] = useState<boolean | null>(null);
  const [hasBypassed, setHasBypassed] = useState<boolean>(() => {
    try { return localStorage.getItem('retainai_bypass') === '1'; } catch { return false; }
  });

  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),60000); return ()=>clearInterval(id)},[]);
  useEffect(()=>{
    if(selectedCustomerId) return;
    let cancelled=false;
    (async()=>{
      try{
        const customers = await getCustomers().catch(()=>[]);
        if(!cancelled){
          setHasCustomers(customers.length>0);
          if(customers.length>0 && !selectedCustomerId){
            setSelectedCustomerId(customers[0].id);
          } else if(customers.length===0 && !isAuthenticated){
            // keep hasCustomers false to show onboarding prompt
          }
        }
      }catch{}
    })();
    return ()=>{cancelled=true};
  },[selectedCustomerId, isAuthenticated]);
  // poll hasCustomers when tab changes to keep onboarding prompt fresh
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const customers = await getCustomers().catch(()=>[]);
        if(!cancelled) setHasCustomers(customers.length>0);
      }catch{}
    })();
    return ()=>{cancelled=true};
  },[activeTab]);

  // Auto-land on Onboarding when tenant has 0 customers (fresh org) — fixes refresh starting at Command Center
  useEffect(()=>{
    if (hasCustomers===false && activeTab==='command') {
      setActiveTab('onboarding');
    }
  },[hasCustomers, activeTab]);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customer360');
    setMobileNavOpen(false);
    window.scrollTo({top:0, behavior:'smooth'});
  };

  const [confirmReset,setConfirmReset]=useState(false);
  const handleResetDemo = async () => {
    if(!confirmReset){ setConfirmReset(true); return; }
    try {
      setResetting(true); setConfirmReset(false);
      const res = await resetDemo();
      setToast(res.message || "Database reset — 101 accounts restored");
      setTimeout(()=> window.location.reload(), 900);
    } catch {
      setToast("Reset failed — run `python -m retainai.scripts.seed_database` in backend");
      setTimeout(()=> setToast(null), 3000);
    } finally { setResetting(false); }
  };

  // Simplified, ordered by workflow: Setup → Workspace (SENSE) → Data (separate + common) → Analytics (MEASURE) → Intelligence → System
  const navSections: {title:string, items:{id:Tab,label:string,icon:any}[]}[] = [
    {title:'START', items:[{id:'onboarding', label:'Onboarding', icon:Users}]},
    {title:'WORKSPACE', items:[
      {id:'command', label:'Command Center', icon:LayoutDashboard},
      {id:'customers', label:'Customers', icon:Users},
      {id:'customer360', label:'Customer 360', icon:UserCircle2},
    ]},
    {title:'DATA', items:[{id:'datahub', label:'Data Hub', icon:Database}]},
    {title:'ANALYTICS', items:[{id:'analytics', label:'Analytics', icon:BarChart3}]},
    {title:'INTELLIGENCE', items:[
      {id:'chat', label:'Chat (5 Agents)', icon:MessageCircle},
      {id:'investigations', label:'Investigations', icon:SearchCode},
      {id:'interventions', label:'Interventions', icon:ClipboardList},
      {id:'learning', label:'Learning', icon:GraduationCap},
    ]},
    {title:'SYSTEM', items:[
      {id:'settings', label:'Settings', icon:Settings},
      {id:'audit', label:'Activity', icon:ScrollText},
    ]},
  ];

  // High-engineer entry: login/signup is the demo start. Show full-screen LoginPage until auth or bypass.
  if (!isAuthenticated && !hasBypassed) {
    return (
      <LoginPage
        initialMode="signup"
        onSuccess={() => {
          setHasBypassed(false);
          setToast('Authenticated — tenant ' + (tenantId || ''));
          setTimeout(() => setToast(null), 2000);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5] text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      <div className="bg-[#0F172A] text-slate-300 text-[11px] font-mono tracking-wide">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-7 flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {hasCustomers===false ? 'No customers — start with Onboarding → Import' : `Tenant ${tenantId?.slice(0,8) || '—'} · SENSE → THINK → ACT → MEASURE → LEARN`}
          </span>
          <span className="hidden md:inline text-slate-400">Updated {now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · {hasCustomers===false ? '0 customers' : 'Dynamic'} · Groq · OpenAI · Gemini</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-[56px] flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={()=>setMobileNavOpen(v=>!v)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 shrink-0" aria-label="Toggle navigation">
              {mobileNavOpen ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
            </button>
            <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[15px] tracking-tight whitespace-nowrap">RETAIN<span className="font-normal text-slate-500">AI</span></span>
                <span className="hidden sm:inline text-[10px] border border-slate-200 bg-slate-50 px-1.5 py-0.5 rounded font-mono text-slate-600 whitespace-nowrap">AUTONOMOUS ENGINE v1.0</span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 -mt-0.5 leading-none truncate">Customer retention intelligence — closed-loop system</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-slate-500 border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded-lg max-w-[220px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate max-w-[180px]" title={`${user?.email || 'demo@retainai.io'} · ${tenantId || 'demo-tenant-001'}`}>{user?.email || 'demo@retainai.io'} · {tenantId || 'demo-tenant-001'}</span>
              {hasCustomers===false && <span className="bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">No customers</span>}
            </div>
            <button onClick={()=>{ setActiveTab('onboarding'); window.scrollTo({top:0, behavior:'smooth'}); }} className="hidden sm:inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 whitespace-nowrap shrink-0">
              <Users className="w-3.5 h-3.5 shrink-0" /> Onboarding
            </button>
            <button onClick={()=>{ setCustomersImportOpen(true); setActiveTab('customers'); window.scrollTo({top:0, behavior:'smooth'}); }} className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5 shrink-0" /> Import
            </button>
            {isAuthenticated && user ? (
              <button onClick={() => { try { localStorage.removeItem('retainai_bypass'); } catch {}; logout(); window.location.reload(); }} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 whitespace-nowrap shrink-0">
                <LogOut className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <button onClick={() => setShowLogin(true)} className="inline-flex items-center gap-1.5 bg-[#0F172A] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 whitespace-nowrap shrink-0">
                <LogIn className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Login</span>
              </button>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={handleResetDemo} disabled={resetting} className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50 whitespace-nowrap ${confirmReset ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${resetting? 'animate-spin':''}`} /> <span className="hidden sm:inline">{confirmReset ? 'Confirm?' : 'Reset'}</span>
              </button>
              {confirmReset && <button onClick={()=>setConfirmReset(false)} className="text-xs border border-slate-200 bg-white px-2 py-1.5 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0">Cancel</button>}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex gap-6">
        <aside className="hidden lg:block w-[220px] shrink-0 sticky top-[88px] h-fit">
          <nav className="space-y-4">
            {navSections.map(sec=>(
              <div key={sec.title}>
                <div className="text-[10px] font-mono tracking-widest text-slate-400 px-3 mb-1">{sec.title}</div>
                <div className="space-y-1">
                  {sec.items.map(item=>{
                    const Active=item.icon; const active=activeTab===item.id;
                    const isOnboarding = item.id==='onboarding' && hasCustomers===false;
                    return (
                      <button key={item.id} onClick={()=>setActiveTab(item.id)} className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${active ? 'bg-[#0F172A] text-white shadow-sm' : isOnboarding ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100' : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200'}`}>
                        <Active className={`w-4 h-4 ${active ? 'text-white' : isOnboarding ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span className="font-medium">{item.label}</span>
                        {isOnboarding && <span className="ml-auto text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-mono">START</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-6 bg-white border border-slate-200 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-slate-900">How RETAINAI works</div>
            <div className="mt-2 text-[11px] leading-relaxed text-slate-600 font-mono">
              SENSE → THINK → ACT → MEASURE → LEARN
            </div>
            <div className="mt-2 text-xs text-slate-600 leading-relaxed">
              Detects change, investigates with evidence, acts, measures, learns — per tenant.
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 font-mono px-1">© 2026 RETAINAI · tenant {tenantId?.slice(0,8) || '—'}</div>
        </aside>

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-30 bg-black/20" onClick={()=>setMobileNavOpen(false)}>
            <div onClick={e=>e.stopPropagation()} className="w-[280px] h-full bg-white border-r border-slate-200 p-4 overflow-auto">
              <nav className="space-y-4">
                {navSections.map(sec=>(
                  <div key={sec.title}>
                    <div className="text-[10px] font-mono tracking-widest text-slate-400 px-2 mb-1">{sec.title}</div>
                    <div className="space-y-1">
                      {sec.items.map(item=>{
                        const Icon=item.icon; const active=activeTab===item.id;
                        return <button key={item.id} onClick={()=>{setActiveTab(item.id); setMobileNavOpen(false)}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active? 'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-50'}`}><Icon className="w-4 h-4"/>{item.label}</button>
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0">
          {toast && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 rounded-lg">{toast}</div>}
          {hasCustomers===false && activeTab==='command' && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-amber-900">No customers yet — start here</div>
                <div className="text-xs text-amber-800 mt-1">Any user can bring their own data. Import CSV (any headers via Map columns), JSON batch, webhook, or use Onboarding wizard. Or click Reset to load sample 101.</div>
              </div>
              <button onClick={()=> setActiveTab('onboarding')} className="shrink-0 bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-amber-700">Open Onboarding →</button>
            </div>
          )}
          {activeTab==='command' && <CommandCenter onSelectCustomer={handleSelectCustomer} />}
          {activeTab==='customers' && <CustomersView onSelectCustomer={handleSelectCustomer} initialShowImport={customersImportOpen} onImportConsumed={()=>setCustomersImportOpen(false)} />}
          {activeTab==='customer360' && (selectedCustomerId ? <Customer360 customerId={selectedCustomerId} /> : <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center"><div className="text-sm font-semibold">No customer selected</div><div className="text-xs text-slate-500 mt-1">Select an account from Command Center or Customers, or import your own data via Onboarding.</div><div className="flex items-center justify-center gap-2 mt-3"><button onClick={()=>setActiveTab('command')} className="bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm">Go to Command Center</button><button onClick={()=>setActiveTab('onboarding')} className="border border-slate-200 bg-white px-4 py-2 rounded-lg text-sm">Onboarding</button></div></div>)}
          {activeTab==='investigations' && <InvestigationsView onSelectCustomer={handleSelectCustomer} />}
          {activeTab==='interventions' && <InterventionsView />}
          {activeTab==='learning' && <LearningView />}
          {activeTab==='analytics' && <AnalyticsView />}
          {activeTab==='datahub' && <DataHubView onSelectCustomer={handleSelectCustomer} />}
          {activeTab==='chat' && <ChatView onSelectCustomer={handleSelectCustomer} />}
          {activeTab==='onboarding' && <Onboarding onComplete={()=> setActiveTab('command')} />}
          {activeTab==='settings' && <SettingsView />}
          {activeTab==='audit' && <AuditView />}
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-mono">
          <span>RETAINAI · Tenant {tenantId} · Evidence-based · No fabricated certainty</span>
          <span>Loop: SENSE → THINK → ACT → MEASURE → LEARN → REPEAT</span>
        </div>
      </footer>

      {showLogin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowLogin(false)}>
          <div onClick={e=>e.stopPropagation()} className="w-full max-w-[480px]">
            <LoginPage onSuccess={()=>{ setShowLogin(false); setToast('Logged in — tenant '+ (tenantId||'')); setTimeout(()=> setToast(null), 2000); window.location.reload(); }} />
            <button onClick={()=>setShowLogin(false)} className="mt-3 mx-auto block text-xs text-white/80 hover:text-white">Close</button>
          </div>
        </div>
      )}
      {/* Global parallel chat — customer-aware when on 360 */}
      <ChatWidget customerId={selectedCustomerId || undefined} customerName={undefined} />
    </div>
  );
}
export default App;
