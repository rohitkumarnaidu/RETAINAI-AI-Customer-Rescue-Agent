import { useState, useEffect, useMemo, useRef } from 'react';
import { CommandCenter } from './components/CommandCenter';
import { Customer360 } from './components/Customer360';
import { ActionCenter } from './components/ActionCenter';
import {
  resetDemo,
  getCustomers,
  getAllInterventions,
  getExperienceMemories,
  getCustomerTimeline,
  type Customer,
  type Intervention,
} from './services/api';
import {
  LayoutDashboard,
  Users,
  UserCircle2,
  Search,
  ClipboardCheck,
  GraduationCap,
  Shield,
  RefreshCw,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Activity,
  Database,
  FileSearch,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────
type TabId = 'command' | 'customers' | 'customer360' | 'investigations' | 'interventions' | 'learning';
type Toast = { message: string; kind: 'success' | 'error' } | null;

interface NavItem {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'command', label: 'Command Center', shortLabel: 'Command', icon: LayoutDashboard, description: 'Portfolio overview' },
  { id: 'customers', label: 'Customers', shortLabel: 'Customers', icon: Users, description: 'All accounts' },
  { id: 'customer360', label: 'Customer 360', shortLabel: '360', icon: UserCircle2, description: 'Account detail' },
  { id: 'investigations', label: 'Investigations', shortLabel: 'Investigations', icon: FileSearch, description: 'Agent runs' },
  { id: 'interventions', label: 'Interventions', shortLabel: 'Interventions', icon: ClipboardCheck, description: 'Action plans' },
  { id: 'learning', label: 'Learning + Activity', shortLabel: 'Learning', icon: GraduationCap, description: 'Memory & audit' },
];

const BREADCRUMBS: Record<TabId, string[]> = {
  command: ['Command Center'],
  customers: ['Customers'],
  customer360: ['Customers', 'Customer 360'],
  investigations: ['Investigations'],
  interventions: ['Interventions'],
  learning: ['Learning & Activity'],
};

// ── Placeholder shells (filled by other agents) ────────────────────────

function CustomersShell({ onSelectCustomer }: { onSelectCustomer: (id: string) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getCustomers();
        if (!cancelled) setCustomers(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(needle) ||
      c.domain.toLowerCase().includes(needle) ||
      c.csm_name.toLowerCase().includes(needle)
    );
  }, [customers, q]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-ink-muted">
        <Loader2 className="w-6 h-6 animate-spin text-ink-faint" />
        <p className="text-[13px]">Loading accounts…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card p-4 flex gap-3 items-start bg-risk-critical-bg border-risk-critical-border">
        <AlertTriangle className="w-4 h-4 text-risk-critical-text mt-0.5 shrink-0" />
        <div className="text-[13px]">
          <p className="font-semibold text-risk-critical-text">Could not load customers</p>
          <p className="text-risk-critical-text/80 text-xs mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Customers</h1>
          <p className="text-[13px] text-ink-muted mt-1">Synthetic portfolio — search and open Customer 360 for any account.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search name, domain, CSM…"
            className="w-full bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-[13px] placeholder:text-ink-faint focus:outline-none focus:border-ink focus:ring-0"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-subtle flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted">{filtered.length} of {customers.length} accounts</span>
          <span className="text-[11px] font-mono text-ink-faint">ID · Name · Segment · ARR</span>
        </div>
        <div className="divide-y divide-border-subtle max-h-[560px] overflow-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectCustomer(c.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-surface-muted transition-colors group focus:outline-none focus-visible:bg-surface-muted"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink group-hover:text-ink truncate">{c.name}</div>
                <div className="text-xs text-ink-muted font-mono truncate">{c.id} · {c.domain} · {c.segment}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className="hidden sm:inline text-xs font-mono text-ink-muted">${c.arr.toLocaleString()}</span>
                <span className="hidden sm:inline text-[11px] px-2 py-1 rounded-full border bg-surface text-ink-muted border-border">{c.lifecycle_stage}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-ink-faint group-hover:text-ink transition-colors" />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink-muted">No accounts match “{q}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvestigationsShell({ onSelectCustomer }: { onSelectCustomer: (id: string) => void }) {
  const [items, setItems] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getAllInterventions().catch(() => [] as Intervention[]);
        if (!cancelled) setItems(data as Intervention[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load investigations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-ink-muted">
        <Loader2 className="w-6 h-6 animate-spin text-ink-faint" />
        <p className="text-[13px]">Loading investigations…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Investigations</h1>
          <p className="text-[13px] text-ink-muted mt-1">Agent runs, root-cause hypotheses and evidence. Results appear after running an investigation from Customer 360.</p>
        </div>
        <span className="shrink-0 text-xs font-mono px-2.5 py-1 rounded-full bg-surface border border-border text-ink-muted">{items.length} runs</span>
      </div>

      {error && (
        <div className="card p-3 flex gap-2 items-center text-[13px] text-risk-critical-text bg-risk-critical-bg border-risk-critical-border">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-surface-muted border border-border flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-ink-faint" />
          </div>
          <h3 className="text-sm font-semibold text-ink mt-3">No investigations yet</h3>
          <p className="text-[13px] text-ink-muted mt-1 max-w-md mx-auto">Investigations are created when you run the AI agent on a Customer 360 page. Each run cites evidence and proposes a retention plan.</p>
          <p className="text-xs font-mono text-ink-faint mt-3">API: POST /api/v1/agent/investigate/:customerId</p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-border-subtle">
          {items.slice(0, 30).map(it => (
            <div key={it.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-surface-subtle transition-colors">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{it.title || 'Investigation'}</div>
                <div className="text-xs text-ink-muted truncate">{it.customer_id} · {it.status} · {new Date(it.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => onSelectCustomer(it.customer_id)} className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border bg-surface border-border hover:border-border-strong text-ink-muted hover:text-ink transition-colors">Open 360</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InterventionsShell({ onSelectCustomer }: { onSelectCustomer: (id: string) => void }) {
  const [items, setItems] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getAllInterventions().catch(() => [] as Intervention[]);
        if (!cancelled) setItems(data as Intervention[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    const needle = filter.toLowerCase();
    return items.filter(i => (i.status || '').toLowerCase().includes(needle));
  }, [items, filter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-ink-muted">
        <Loader2 className="w-6 h-6 animate-spin text-ink-faint" />
        <p className="text-[13px]">Loading interventions…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Interventions</h1>
          <p className="text-[13px] text-ink-muted mt-1">Retention plans and outreach drafts awaiting CSM approval.</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-muted border border-border">
          {(['ALL', 'PENDING', 'APPROVED'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === v ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              aria-pressed={filter === v}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-surface-muted border border-border flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-ink-faint" />
          </div>
          <h3 className="text-sm font-semibold text-ink mt-3">No interventions in this view</h3>
          <p className="text-[13px] text-ink-muted mt-1">Approve a plan from Customer 360 to see it here. Other agents will add bulk actions and filtering.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.slice(0, 40).map(it => (
            <div key={it.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-hover">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink truncate">{it.title}</span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${String(it.status).toLowerCase().includes('approv') ? 'bg-risk-healthy-bg border-risk-healthy-border text-risk-healthy-text' : 'bg-risk-watch-bg border-risk-watch-border text-risk-watch-text'}`}>{it.status}</span>
                </div>
                <div className="text-xs text-ink-muted mt-1 truncate">{it.objective}</div>
                <div className="text-[11px] font-mono text-ink-faint mt-1">{it.customer_id} · {it.priority} · {new Date(it.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-ink-muted">{it.plan_steps?.length || 0} steps</span>
                <button onClick={() => onSelectCustomer(it.customer_id)} className="text-xs font-medium px-3 py-1.5 rounded-md bg-ink text-white hover:bg-accent-hover transition-colors">View customer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTimeline() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Try to seed from a few known customers' timelines for demo activity
        const customers = await getCustomers().catch(() => [] as Customer[]);
        const sample = customers.slice(0, 5);
        const all: any[] = [];
        for (const c of sample) {
          try {
            const tl = await getCustomerTimeline(c.id, 14).catch(() => []);
            all.push(...(tl as any[]).map((e: any) => ({ ...e, customer_id: c.id, customer_name: c.name })));
          } catch { /* ignore */ }
        }
        all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (!cancelled) setEvents(all.slice(0, 20));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-ink-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Loading activity…</span>
      </div>
    );
  }

  if (events.length === 0) {
    return <div className="text-[13px] text-ink-muted py-6">No recent activity. Interactions will appear here as agents run and plans are approved.</div>;
  }

  return (
    <div className="relative pl-6 border-l border-border space-y-4">
      {events.map((e: any) => (
        <div key={e.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full bg-surface border-2 border-ink/20" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink truncate">{e.title}</div>
              <div className="text-xs text-ink-muted truncate">{e.customer_name || e.customer_id} · {e.source} · {e.type}</div>
              {e.description && <p className="text-xs text-ink-muted mt-1 line-clamp-2">{e.description}</p>}
            </div>
            <span className="shrink-0 text-[11px] font-mono text-ink-faint">{new Date(e.timestamp).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LearningShell() {
  const [memCount, setMemCount] = useState<number | null>(null);
  useEffect(() => {
    getExperienceMemories().then(m => setMemCount((m as any)?.length ?? 0)).catch(() => setMemCount(null));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Learning + Activity</h1>
        <p className="text-[13px] text-ink-muted mt-1">
          Experience memories, outcome deltas and audit trail. {memCount !== null && <span className="font-mono text-ink-faint">{memCount} memories in store</span>}
        </p>
      </div>

      {/* Experience memories — delegated to existing ActionCenter for fidelity; wrapped in card */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold text-ink">Experience Memory</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-muted border border-border text-ink-muted ml-auto">SENSE → THINK → ACT → MEASURE → LEARN</span>
        </div>
        <ActionCenter />
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold text-ink">Recent Activity</h2>
          <span className="text-xs text-ink-muted ml-auto">Last 14 days · sampled accounts</span>
        </div>
        <AuditTimeline />
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('command');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('acme-corp-001');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [toast, setToast] = useState<Toast>(null);
  const [headerQuery, setHeaderQuery] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const mainRef = useRef<HTMLElement>(null);

  // Keep selectedCustomerId wiring for tab switch
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customer360');
    setMobileOpen(false);
    // focus main for screen readers
    setTimeout(() => mainRef.current?.focus(), 0);
  };

  const handleResetDemo = async () => {
    try {
      setResetting(true);
      const res = await resetDemo();
      setToast({ message: res.message || 'Demo reset — reloading data.', kind: 'success' });
      setLastUpdated(new Date());
      window.setTimeout(() => window.location.reload(), 1100);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Reset failed. Run: uv run python -m retainai.scripts.seed_database';
      setToast({ message: msg, kind: 'error' });
    } finally {
      setResetting(false);
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // "Updated X min ago" ticker — updates every 60s
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const updatedLabel = useMemo(() => {
    const diffMin = Math.max(0, Math.floor((now - lastUpdated.getTime()) / 60_000));
    if (diffMin === 0) return 'just now';
    if (diffMin === 1) return '1 min ago';
    return `${diffMin} min ago`;
  }, [now, lastUpdated]);

  // Header search → Customers tab
  const onHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerQuery.trim()) {
      setActiveTab('customers');
      setMobileOpen(false);
    }
  };

  const activeItem = NAV_ITEMS.find(n => n.id === activeTab);

  return (
    <div className="min-h-screen bg-background text-ink antialiased">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-ink focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Demo environment banner */}
      <div className="sticky top-0 z-40 bg-[#FFF7ED] border-b border-[#FDBA74]/50 text-[#9A3412] text-[12px]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-7 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-medium truncate">
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#EA580C]" />
              Demo environment
            </span>
            <span className="opacity-40 hidden sm:inline">·</span>
            <span className="opacity-80 hidden sm:inline">Synthetic customer data</span>
            <span className="opacity-40 hidden sm:inline">·</span>
            <span className="font-mono opacity-80">101 accounts</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono opacity-70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Telemetry seeded
          </span>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto flex min-h-[calc(100vh-28px)]">
        {/* ——— Desktop Sidebar ——— */}
        <aside
          aria-label="Primary navigation"
          className={`hidden lg:flex shrink-0 flex-col border-r border-border bg-surface sticky top-7 h-[calc(100vh-28px)] transition-all duration-200 ${sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'}`}
        >
          {/* Brand */}
          <div className={`h-[64px] flex items-center gap-3 border-b border-border px-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold tracking-tight text-ink">RETAINAI</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-muted border border-border text-ink-muted">Demo</span>
                </div>
                <div className="text-[11px] text-ink-muted leading-none">Rescue Agent</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto" aria-label="Sections">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors text-left
                    ${isActive
                      ? 'bg-ink text-white shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-muted'
                    }
                    ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-ink-faint'}`} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" aria-hidden />}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* System status */}
          <div className={`border-t border-border p-3 space-y-2 ${sidebarCollapsed ? 'px-2' : ''}`}>
            {!sidebarCollapsed ? (
              <>
                <div className="flex items-center gap-2 text-[11px] font-mono text-ink-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                  Monitoring · {updatedLabel}
                </div>
                <div className="text-[11px] text-ink-faint leading-relaxed">api/v1 · 101 accounts · SENSE→LEARN loop</div>
              </>
            ) : (
              <div className="flex justify-center" title={`Monitoring · ${updatedLabel}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <div className="border-t border-border p-2">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="w-full flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface hover:bg-surface-muted text-ink-muted hover:text-ink px-2 py-1.5 text-xs font-medium transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <><ChevronLeft className="w-3.5 h-3.5" /> Collapse</>}
            </button>
          </div>
        </aside>

        {/* ——— Main column ——— */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-7 z-30 bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/80 border-b border-border">
            <div className="h-[64px] px-4 sm:px-6 lg:px-8 flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
                className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-border bg-surface text-ink-muted hover:text-ink hover:border-border-strong transition-colors"
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              {/* Breadcrumbs */}
              <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-[13px] min-w-0">
                <span className="text-ink-faint hidden md:inline">RETAINAI</span>
                <span className="text-ink-faint hidden md:inline">/</span>
                {BREADCRUMBS[activeTab].map((crumb, idx, arr) => (
                  <span key={crumb} className="flex items-center gap-1.5 min-w-0">
                    <span className={idx === arr.length - 1 ? 'font-semibold text-ink truncate' : 'text-ink-muted truncate'}>{crumb}</span>
                    {idx < arr.length - 1 && <span className="text-ink-faint">/</span>}
                  </span>
                ))}
                {activeItem && <span className="hidden lg:inline text-ink-faint ml-1">— {activeItem.description}</span>}
              </nav>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Search — header */}
              <form onSubmit={onHeaderSearchSubmit} className="hidden md:flex items-center gap-2" role="search" aria-label="Search accounts">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                  <input
                    value={headerQuery}
                    onChange={e => setHeaderQuery(e.target.value)}
                    placeholder="Search accounts, domains, CSMs…"
                    aria-label="Search"
                    className="w-[260px] xl:w-[320px] bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-[13px] placeholder:text-ink-faint focus:outline-none focus:border-ink"
                  />
                </div>
                <button type="submit" className="hidden xl:inline-flex text-xs font-medium px-3 py-2 rounded-md border border-border bg-surface hover:bg-surface-muted text-ink-muted hover:text-ink transition-colors">Search</button>
              </form>

              {/* Status indicator */}
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-mono text-ink-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                  Monitoring
                </span>
                <span className="text-ink-faint">·</span>
                <span className="font-mono text-ink-faint hidden xl:inline">Updated {updatedLabel}</span>
                <span className="inline-flex items-center gap-1 text-ink-faint">
                  <Clock3 className="w-3 h-3" />
                  <span className="hidden lg:inline">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>

              {/* Demo badge */}
              <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-medium px-2 py-1 rounded-full bg-surface-muted border border-border text-ink-muted">Demo</span>

              {/* Reset Demo */}
              <button
                onClick={handleResetDemo}
                disabled={resetting}
                aria-busy={resetting}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface hover:bg-surface-muted text-ink-muted hover:text-ink px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60"
                title="Reseed 101 synthetic accounts"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{resetting ? 'Resetting…' : 'Reset Demo'}</span>
                <span className="sm:hidden">Reset</span>
              </button>
            </div>

            {/* Mobile nav drawer */}
            {mobileOpen && (
              <div id="mobile-nav" className="lg:hidden border-t border-border bg-surface">
                <nav className="px-3 py-3 grid grid-cols-2 gap-2" aria-label="Mobile sections">
                  {NAV_ITEMS.map(item => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-medium border text-left transition-colors ${isActive ? 'bg-ink text-white border-ink' : 'bg-surface border-border text-ink-muted hover:text-ink hover:border-border-strong'}`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.shortLabel}</span>
                      </button>
                    );
                  })}
                </nav>
                {/* Mobile search */}
                <form onSubmit={onHeaderSearchSubmit} className="px-3 pb-3 flex gap-2 md:hidden" role="search">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      value={headerQuery}
                      onChange={e => setHeaderQuery(e.target.value)}
                      placeholder="Search accounts…"
                      className="w-full bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-[13px] placeholder:text-ink-faint focus:outline-none focus:border-ink"
                    />
                  </div>
                  <button type="submit" className="px-3 py-2 rounded-md bg-ink text-white text-xs font-medium">Go</button>
                </form>
              </div>
            )}
          </header>

          {/* Toast */}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={`mx-4 sm:mx-6 lg:mx-8 mt-4 px-4 py-3 rounded-lg border text-[13px] flex items-center gap-2 animate-slide-in ${toast.kind === 'success' ? 'bg-risk-healthy-bg border-risk-healthy-border text-risk-healthy-text' : 'bg-risk-critical-bg border-risk-critical-border text-risk-critical-text'}`}
            >
              {toast.kind === 'success' ? <RefreshCw className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span className="flex-1">{toast.message} {toast.kind === 'success' && <span className="opacity-70">(Reloading…)</span>}</span>
              <button
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main content */}
          <main
            id="main-content"
            ref={mainRef as any}
            tabIndex={-1}
            className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 outline-none"
          >
            {activeTab === 'command' && <CommandCenter onSelectCustomer={handleSelectCustomer} />}
            {activeTab === 'customers' && <CustomersShell onSelectCustomer={handleSelectCustomer} />}
            {activeTab === 'customer360' && <Customer360 customerId={selectedCustomerId} />}
            {activeTab === 'investigations' && <InvestigationsShell onSelectCustomer={handleSelectCustomer} />}
            {activeTab === 'interventions' && <InterventionsShell onSelectCustomer={handleSelectCustomer} />}
            {activeTab === 'learning' && <LearningShell />}
          </main>

          {/* Footer */}
          <footer className="border-t border-border bg-surface/60 mt-auto">
            <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-2 font-mono text-ink-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                System nominal · FastAPI · {activeItem?.label}
              </span>
              <span className="font-mono text-ink-faint">SENSE → THINK → ACT → MEASURE → LEARN</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;
