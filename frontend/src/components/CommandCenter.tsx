import React, { useState, useEffect } from 'react';
import { Customer, getCustomers, getCustomerRisk, getPortfolio } from '../services/api';
import { RiskBadge } from './RiskBadge';
import { Users, AlertTriangle, TrendingDown, DollarSign, ArrowUpRight, Search, ShieldAlert, Sparkles, Star } from 'lucide-react';

interface CommandCenterProps {
  onSelectCustomer: (customerId: string) => void;
}

interface CustomerWithRisk extends Customer {
  latestRisk?: {
    risk_level?: string;
    root_cause?: string;
    primary_root_cause?: string;
  };
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ onSelectCustomer }) => {
  const [customers, setCustomers] = useState<CustomerWithRisk[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Try bulk portfolio first (fast)
        try {
          const portfolio: any = await getPortfolio();
          const customersWithRisk = portfolio.customers.map((c: any) => ({
            ...c,
            latestRisk: { risk_level: c.risk_level, health_score: c.health_score },
          }));
          setCustomers(customersWithRisk);
          return;
        } catch {}
        // Fallback N+1
        const customerList = await getCustomers();
        const customersWithRisk = await Promise.all(
          customerList.map(async (cust) => {
            try {
              const riskData: any = await getCustomerRisk(cust.id);
              let latest: any = Array.isArray(riskData) ? riskData[0] : riskData;
              return { ...cust, latestRisk: latest };
            } catch { return cust; }
          })
        );
        setCustomers(customersWithRisk);
      } catch (err: any) {
        setError(err.message || 'Failed to connect to backend server');
      } finally { setLoading(false); }
    };

    fetchData();
  }, []);

  // Compute portfolio metrics
  const totalARR = customers.reduce((sum, c) => sum + c.arr, 0);
  const criticalCount = customers.filter((c) => c.latestRisk?.risk_level === 'CRITICAL' || c.latestRisk?.risk_level === 'HIGH_RISK').length;
  const watchCount = customers.filter((c) => c.latestRisk?.risk_level === 'WATCH' || c.latestRisk?.risk_level === 'AT_RISK').length;
  const atRiskARR = customers
    .filter((c) => ['CRITICAL', 'HIGH_RISK', 'WATCH', 'AT_RISK'].includes(c.latestRisk?.risk_level || ''))
    .reduce((sum, c) => sum + c.arr, 0);

  // Check if Acme Corp exists and put it at top if present
  const acmeCustomer = customers.find(c => c.name.toLowerCase().includes('acme'));

  const filteredCustomers = customers.filter((cust) => {
    const matchesSearch =
      cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.csm_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRisk =
      filterRisk === 'ALL' ||
      (cust.latestRisk?.risk_level || 'HEALTHY') === filterRisk;

    return matchesSearch && matchesRisk;
  }).sort((a, b) => {
    // Acme Corp always comes first if matching
    if (a.name.toLowerCase().includes('acme')) return -1;
    if (b.name.toLowerCase().includes('acme')) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Connecting to RETAINAI Intelligence Engine (101 Benchmark Accounts)...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
        <div>
          <h3 className="font-semibold text-rose-200">Failed to load Portfolio Data</h3>
          <p className="text-sm text-rose-400/80">{error}. Ensure the FastAPI backend is running at http://localhost:8000.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prominent Acme Corp Hero Feature Banner if Acme exists */}
      {acmeCustomer && (
        <div className="bg-gradient-to-r from-amber-950/40 via-indigo-950/50 to-slate-900 border border-amber-500/30 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
          <div className="flex items-center gap-4 z-10">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
              <Star className="w-6 h-6 fill-amber-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">Featured Benchmark Account</span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">Hero Scenario</span>
              </div>
              <h3 className="text-xl font-bold text-white mt-0.5">{acmeCustomer.name}</h3>
              <p className="text-xs text-slate-300 mt-1">
                ARR: <strong className="text-emerald-400">${acmeCustomer.arr.toLocaleString()}</strong> · Domain: <span className="font-mono">{acmeCustomer.domain}</span> · CSM: {acmeCustomer.csm_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10 w-full md:w-auto">
            <RiskBadge level={acmeCustomer.latestRisk?.risk_level || 'WATCH'} size="md" />
            <button
              onClick={() => onSelectCustomer(acmeCustomer.id)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-amber-950/40"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Acme 360 Rescue</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Portfolio ARR</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">${totalARR.toLocaleString()}</div>
          <div className="text-xs text-indigo-400 font-mono mt-1">{customers.length} Accounts Active (Dataset v2)</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">ARR At Risk</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">${atRiskARR.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">
            {totalARR > 0 ? ((atRiskARR / totalARR) * 100).toFixed(1) : 0}% of Total Portfolio
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Critical Accounts</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{criticalCount}</div>
          <div className="text-xs text-rose-400/80 mt-1">Immediate Agent Intervention Needed</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Watchlist</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{watchCount}</div>
          <div className="text-xs text-amber-400/80 mt-1">Early Warning Indicators Triggered</div>
        </div>
      </div>

      {/* Customer List Header & Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100">Customer Risk Portfolio</h2>
            <span className="bg-indigo-950/80 text-indigo-400 text-xs px-2.5 py-0.5 rounded-full border border-indigo-800/40">
              Showing {filteredCustomers.length} of {customers.length}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter accounts or CSMs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs">
              {['ALL', 'CRITICAL', 'WATCH', 'HEALTHY'].map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterRisk(level)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterRisk === level
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-4">Customer Account</th>
                <th className="p-4">Risk Level</th>
                <th className="p-4">ARR</th>
                <th className="p-4">Primary Root Cause</th>
                <th className="p-4">CSM Owner</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No customers match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const riskLevel = cust.latestRisk?.risk_level || 'HEALTHY';
                  const isAcme = cust.name.toLowerCase().includes('acme');
                  const rootCause = cust.latestRisk?.root_cause || cust.latestRisk?.primary_root_cause || 'No active risk detected';

                  return (
                    <tr
                      key={cust.id}
                      className={`hover:bg-slate-800/40 transition-colors group cursor-pointer ${
                        isAcme ? 'bg-amber-950/20 border-l-2 border-l-amber-500' : ''
                      }`}
                      onClick={() => onSelectCustomer(cust.id)}
                    >
                      <td className="p-4 font-medium text-slate-200">
                        <div className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                          {cust.name}
                          {isAcme && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                        </div>
                        <div className="text-slate-500 text-[11px] font-mono">{cust.domain} · {cust.segment}</div>
                      </td>
                      <td className="p-4">
                        <RiskBadge level={riskLevel} />
                      </td>
                      <td className="p-4 font-mono font-medium text-slate-200">
                        ${cust.arr.toLocaleString()}
                      </td>
                      <td className="p-4 max-w-xs truncate text-slate-400">
                        {rootCause}
                      </td>
                      <td className="p-4 text-slate-400">
                        <div>{cust.csm_name}</div>
                        <div className="text-[11px] text-slate-500">{cust.csm_email}</div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCustomer(cust.id);
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            isAcme
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300'
                              : 'bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/50 text-indigo-300'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>360 View</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
