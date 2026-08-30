import React, { useEffect, useState } from 'react';
import { getPortfolio, getCustomerTimeline, getCustomers } from '../services/api';
import { Card, SectionHeader, SkeletonCard, ErrorState, EmptyState } from './ui';
import { Database, Activity, MessageSquare, LifeBuoy, Users, Clock, Search } from 'lucide-react';

type Tab = 'all' | 'customers' | 'usage' | 'support' | 'feedback';

export const DataHubView: React.FC<{ onSelectCustomer?: (id: string) => void }> = ({ onSelectCustomer }) => {
  const [tab, setTab] = useState<Tab>('all');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [timelines, setTimelines] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pf, cs] = await Promise.all([getPortfolio().catch(() => null), getCustomers().catch(() => [])]);
      setPortfolio(pf);
      setCustomers(cs as any[]);
      // Fetch unified timelines for first 12 customers to build cross-tenant hub (tenant-isolated)
      const slice = (cs as any[]).slice(0, 12);
      const tls = await Promise.all(slice.map(c => getCustomerTimeline(c.id, 30).catch(() => [])));
      const flat = tls.flat().sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimelines(flat);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const usage = timelines.filter((e: any) => (e.source || '').toUpperCase().includes('USAGE'));
  const support = timelines.filter((e: any) => (e.source || '').toUpperCase().includes('SUPPORT') || (e.source || '').toUpperCase().includes('TICKET'));
  const feedback = timelines.filter((e: any) => (e.source || '').toUpperCase().includes('FEEDBACK') || (e.source || '').toUpperCase().includes('CSAT'));

  const filteredCustomers = customers.filter((c: any) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.domain.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalCustomers = portfolio?.metrics?.total_customers ?? customers.length;

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Data Hub" subtitle="Separate per data type + common All — where your uploads live, tenant-isolated" icon={Database} action={<button onClick={load} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50">Refresh</button>} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">CUSTOMERS</div>
            <div className="text-xl font-bold mt-1">{customers.length}</div>
            <div className="text-[11px] text-slate-500">{totalCustomers} total</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">USAGE</div>
            <div className="text-xl font-bold mt-1">{usage.length}</div>
            <div className="text-[11px] text-slate-500">events</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">SUPPORT</div>
            <div className="text-xl font-bold mt-1">{support.length}</div>
            <div className="text-[11px] text-slate-500">tickets</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">FEEDBACK</div>
            <div className="text-xl font-bold mt-1">{feedback.length}</div>
            <div className="text-[11px] text-slate-500">entries</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs font-mono text-slate-500">ALL</div>
            <div className="text-xl font-bold mt-1">{timelines.length}</div>
            <div className="text-[11px] text-slate-500">timeline</div>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-3">Uploads appear instantly: <b>CSV/JSON → Customers</b> · <b>Usage/Support/Feedback → respective tabs</b> · <b>All</b> is the unified timeline (like 360, but across all customers).</div>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit">
            {([
              { id: 'all', label: 'All', icon: Clock, count: timelines.length },
              { id: 'customers', label: 'Customers', icon: Users, count: customers.length },
              { id: 'usage', label: 'Usage', icon: Activity, count: usage.length },
              { id: 'support', label: 'Support', icon: LifeBuoy, count: support.length },
              { id: 'feedback', label: 'Feedback', icon: MessageSquare, count: feedback.length },
            ] as const).map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${active ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
                  <Icon className="w-3.5 h-3.5" /> {t.label} <span className={`px-1.5 py-0.5 rounded-full font-mono text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-white border border-slate-200'}`}>{t.count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 sm:max-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'customers' ? 'Search customers...' : 'Search events...'} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-slate-400" />
          </div>
        </div>

        <div className="mt-4">
          {tab === 'customers' ? (
            filteredCustomers.length === 0 ? (
              <EmptyState title="No customers yet" description="Upload CSV/JSON or add manually — they appear here and in Command Center + Analytics." />
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[480px] overflow-auto divide-y divide-slate-100">
                  {filteredCustomers.slice(0, 50).map((c: any) => (
                    <div key={c.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{c.domain} · {c.segment} · {c.risk_level} · {Math.round(c.health_score)}/100</div>
                      </div>
                      {onSelectCustomer && <button onClick={() => onSelectCustomer(c.id)} className="text-xs border border-slate-200 bg-white px-2.5 py-1 rounded-lg hover:bg-slate-50 shrink-0">360 →</button>}
                    </div>
                  ))}
                </div>
                {filteredCustomers.length > 50 && <div className="p-2 text-xs text-slate-500 text-center border-t border-slate-100">{filteredCustomers.length - 50} more — use Customers page filters</div>}
              </div>
            )
          ) : tab === 'all' && timelines.length === 0 ? (
            <EmptyState title="No timeline yet" description="Upload customers + telemetry — unified timeline appears here and in 360." />
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {(tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).filter((e: any) => !q || (e.title || '').toLowerCase().includes(q.toLowerCase())).slice(0, 60).map((e: any) => (
                <div key={e.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-500">{new Date(e.timestamp).toLocaleString()}</span>
                    <span className="text-[11px] border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full font-mono uppercase">{e.source}</span>
                  </div>
                  <div className="text-sm font-medium mt-1">{e.title}</div>
                  {e.description && <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{e.description}</div>}
                </div>
              ))}
              {(tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).length === 0 && <div className="text-xs text-slate-500 text-center py-6">No {tab} events — inject via 360 or bulk API.</div>}
            </div>
          )}
          {tab !== 'customers' && timelines.length > 0 && <div className="text-xs text-slate-500 mt-2">Showing {Math.min(60, (tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).length)} of {(tab === 'all' ? timelines : tab === 'usage' ? usage : tab === 'support' ? support : feedback).length} — common All + separate per-type.</div>}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Where uploads go</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="border border-slate-200 rounded-lg p-3"><div className="font-semibold">CSV / JSON / Single form</div><div className="text-slate-600 mt-1">→ <b>Customers</b> + <b>Data Hub → Customers</b> + <b>Command Center</b> KPI</div></div>
          <div className="border border-slate-200 rounded-lg p-3"><div className="font-semibold">Usage / Support / Feedback</div><div className="text-slate-600 mt-1">→ <b>Data Hub → Usage/Support/Feedback</b> + <b>360 Timeline</b> + <b>All</b></div></div>
          <div className="border border-slate-200 rounded-lg p-3"><div className="font-semibold">Common All</div><div className="text-slate-600 mt-1">Unified timeline across all customers — same as 360 but tenant-wide.</div></div>
        </div>
      </Card>
    </div>
  );
};
