import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Braces, Webhook, Database, ArrowRight, CheckCircle2, Sparkles, Users, Zap, Copy, ExternalLink } from 'lucide-react';
import { CsvUpload } from './CsvUpload';
import { Card, SectionHeader } from './ui';
import { ingestBatch, seedSample, getWebhookUrl } from '../services/api';

type Step = 1 | 2 | 3 | 4;
type BringTab = 'csv' | 'json' | 'webhook' | 'sample';

export const Onboarding: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [bringTab, setBringTab] = useState<BringTab>('csv');
  const [jsonText, setJsonText] = useState('[\n  {"name": "Acme Corp","domain":"acme.com","segment":"Enterprise","arr":180000,"health_score":42},\n  {"name": "Beta LLC","segment":"MidMarket","arr":60000}\n]');
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonResult, setJsonResult] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleJsonBatch = async () => {
    setJsonLoading(true); setJsonError(null); setJsonResult(null);
    try {
      const parsed = JSON.parse(jsonText);
      const arr = Array.isArray(parsed) ? parsed : parsed.customers || parsed.data || [];
      if (!Array.isArray(arr) || arr.length === 0) throw new Error("JSON must be an array of customer objects with at least 'name'");
      if (arr.length > 500) throw new Error(`Too many customers ${arr.length} (max 500)`);
      const res = await ingestBatch(arr as Record<string, unknown>[]);
      setJsonResult(`Created ${res.created} · Skipped ${res.skipped} ${res.tenant_id ? `· tenant ${res.tenant_id}` : ''}`);
      if (res.created > 0) setTimeout(() => setStep(3), 600);
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      setJsonError(err?.response?.data?.detail || err?.message || 'Failed');
    } finally { setJsonLoading(false); }
  };

  const handleSeed = async () => {
    setSeedLoading(true); setSeedResult(null);
    try {
      const r = await seedSample();
      setSeedResult(`${r.message} · ${r.seeded} seeded, ${r.skipped} skipped`);
      setTimeout(() => setStep(4), 500);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setSeedResult(err?.response?.data?.detail || err?.message || 'Seed failed');
    } finally { setSeedLoading(false); }
  };

  const webhookProviders: { id: string; label: string; desc: string; payload: string }[] = [
    { id: 'generic', label: 'Generic', desc: 'Any JSON with customer_id', payload: `{"customer_id":"cust_xxx","event_type":"SUPPORT_TICKET","payload":{"severity":"CRITICAL","subject":"Export fails"}}` },
    { id: 'zendesk', label: 'Zendesk', desc: 'Ticket → SUPPORT_TICKET', payload: `POST ${getWebhookUrl('zendesk')}` },
    { id: 'stripe', label: 'Stripe', desc: 'Invoice → ACCOUNT_EVENT', payload: `POST ${getWebhookUrl('stripe')}` },
    { id: 'hubspot', label: 'HubSpot', desc: 'Feedback → CUSTOMER_FEEDBACK', payload: `POST ${getWebhookUrl('hubspot')}` },
    { id: 'segment', label: 'Segment', desc: 'Track → USAGE_EVENT', payload: `POST ${getWebhookUrl('segment')}` },
  ];

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); });
  };

  return (
    <div className="space-y-6 max-w-[880px]">
      {/* Stepper */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs font-mono">
          {[1, 2, 3, 4].map(n => (
            <React.Fragment key={n}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold border ${step === n ? 'bg-[#0F172A] text-white border-[#0F172A]' : step > n ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200'}`}>{step > n ? '✓' : n}</span>
              <span className={`hidden sm:inline text-[11px] ${step === n ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>{n === 1 ? 'Welcome' : n === 2 ? 'Bring customers' : n === 3 ? 'Telemetry' : 'Done'}</span>
              {n < 4 && <span className={`flex-1 h-px ${step > n ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => setStep(n as Step)} className={`text-xs px-2.5 py-1 rounded-full border ${step === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>Step {n}</button>
          ))}
          {onComplete && step === 4 && <button onClick={onComplete} className="ml-auto text-xs bg-emerald-600 text-white px-3 py-1 rounded-full hover:bg-emerald-700">Go to Command Center →</button>}
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shrink-0"><Sparkles className="w-6 h-6" /></div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Welcome to RETAINAI</h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">RETAINAI learns from <b>your</b> telemetry. Bring customers to see risk instantly — deterministic engines + evidence-grounded agent, isolated per org.</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50"><Users className="w-4 h-4 mb-1" /><b>Any shape</b><br /><span className="text-slate-600">CSV any headers → remap, JSON batch, webhook, or single form</span></div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50"><Zap className="w-4 h-4 mb-1" /><b>Instant signal</b><br /><span className="text-slate-600">Upload → health/risk recomputed in &lt;1s, timeline live</span></div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50"><Database className="w-4 h-4 mb-1" /><b>Isolated</b><br /><span className="text-slate-600">Your tenant only. Memory/BYOK never leaks.</span></div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800">Start: Bring customers <ArrowRight className="w-4 h-4" /></button>
                <button onClick={handleSeed} disabled={seedLoading} className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50">{seedLoading ? 'Seeding...' : 'Or load sample 101'}</button>
              </div>
              {seedResult && <div className="mt-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg">{seedResult}</div>}
            </div>
          </div>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Step 2 — Bring customers" subtitle="Choose any path. All tenant-isolated. CSV supports arbitrary headers via Map columns." icon={Upload} />
            <div className="flex flex-wrap gap-2 mt-3">
              {(['csv', 'json', 'webhook', 'sample'] as BringTab[]).map(t => (
                <button key={t} onClick={() => setBringTab(t)} className={`px-3.5 py-2 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 ${bringTab === t ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  {t === 'csv' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : t === 'json' ? <Braces className="w-3.5 h-3.5" /> : t === 'webhook' ? <Webhook className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}{t === 'csv' ? 'CSV Upload' : t === 'json' ? 'JSON Batch' : t === 'webhook' ? 'Webhook' : 'Sample 101'}
                </button>
              ))}
            </div>
          </Card>

          {bringTab === 'csv' && (
            <div className="space-y-4">
              <CsvUpload onSuccess={() => { setStep(3); onComplete?.(); }} />
              <div className="text-xs text-slate-500">Tip: If your export headers are <code className="bg-slate-100 px-1 py-0.5 rounded">company, revenue</code>, open <b>Map columns</b> and remap <code className="bg-slate-100 px-1 py-0.5 rounded">company → name</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">revenue → arr</code>.</div>
            </div>
          )}

          {bringTab === 'json' && (
            <Card>
              <SectionHeader title="JSON Batch — POST /ingest/batch" subtitle="Paste array of customer objects (any keys). Max 500. Tenant-isolated." icon={Braces} />
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold">Customers JSON array</label>
                  <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} rows={8} className="mt-1 w-full border border-slate-200 rounded-lg p-3 text-xs font-mono focus:outline-none focus:border-slate-400" placeholder={'[{"name":"Acme"}]'} />
                  <div className="text-[11px] text-slate-500 mt-1">Keys: <code className="bg-slate-100 px-1 rounded">name*</code> <code className="bg-slate-100 px-1 rounded">domain</code> <code className="bg-slate-100 px-1 rounded">arr</code> <code className="bg-slate-100 px-1 rounded">segment</code> <code className="bg-slate-100 px-1 rounded">health_score</code> <code className="bg-slate-100 px-1 rounded">risk_level</code> etc. Endpoint: <code className="bg-slate-100 px-1 rounded">POST /ingest/batch {"{"}customers: [...]{"}"}</code></div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleJsonBatch} disabled={jsonLoading} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">{jsonLoading ? 'Ingesting…' : 'Ingest batch'} <ArrowRight className="w-3.5 h-3.5" /></button>
                  <span className="text-xs text-slate-500">or copy cURL:</span>
                  <button onClick={() => copy(`curl -X POST http://localhost:8000/api/v1/ingest/batch -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"customers":'${jsonText}'}'`, 'curl')} className="text-xs border border-slate-200 bg-white px-2 py-1 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"><Copy className="w-3 h-3" />{copied === 'curl' ? 'Copied!' : 'Copy cURL'}</button>
                </div>
                {jsonError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{jsonError}</div>}
                {jsonResult && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{jsonResult}</div>}
              </div>
            </Card>
          )}

          {bringTab === 'webhook' && (
            <Card>
              <SectionHeader title="Webhook — POST /ingest/webhook/{provider}" subtitle="Connect Stripe / HubSpot / Zendesk / Segment / Generic. Tenant-isolated via JWT or X-API-Key + X-Tenant-Id." icon={Webhook} />
              <div className="grid grid-cols-1 gap-3">
                {webhookProviders.map(p => (
                  <div key={p.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div><div className="text-sm font-semibold">{p.label} <span className="text-xs font-normal text-slate-500">— {p.desc}</span></div><div className="text-xs font-mono text-slate-600 mt-1 break-all">{p.id === 'generic' ? 'POST ' + getWebhookUrl('generic') : p.payload}</div></div>
                      <button onClick={() => copy(getWebhookUrl(p.id), p.id)} className="shrink-0 text-xs border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded-lg hover:bg-white inline-flex items-center gap-1"><Copy className="w-3 h-3" />{copied === p.id ? 'Copied' : 'Copy URL'}</button>
                    </div>
                    <details className="mt-2"><summary className="text-xs font-mono text-slate-600 cursor-pointer">Example payload</summary><pre className="text-xs bg-slate-950 text-slate-200 rounded p-2 mt-1 overflow-auto">{p.id === 'generic' ? p.payload : `{"customer_id":"cust_xxx","payload":{"severity":"CRITICAL","subject":"Export fails"}} → ${p.label} maps to ${p.desc.split('→')[1] || ' event'}`}</pre></details>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-slate-900 text-slate-300 rounded-xl p-3 text-xs">
                <div className="font-semibold text-white">Auth</div>
                <div className="mt-1 font-mono text-[11px]">Header: <code className="bg-slate-800 px-1 rounded">Authorization: Bearer &lt;JWT from /auth/login&gt;</code> or <code className="bg-slate-800 px-1 rounded">X-API-Key: $DEMO_API_KEY</code> + <code className="bg-slate-800 px-1 rounded">X-Tenant-Id: tenant_xxx</code></div>
                <div className="mt-2 text-slate-400">Generic requires <code className="bg-slate-800 px-1 rounded">customer_id</code> top-level. Others auto-extract from Stripe `data.object.customer` etc.</div>
              </div>
            </Card>
          )}

          {bringTab === 'sample' && (
            <Card>
              <SectionHeader title="Sample dataset — 101 benchmark accounts" subtitle="Idempotent per tenant. Demonstrates heroic → critical archetypes." icon={Database} />
              <div className="space-y-3">
                <div className="text-sm text-slate-600">Loads <code className="bg-slate-100 px-1 rounded">retainai_dataset_v2.json</code> into your tenant only (skips duplicates).</div>
                <button onClick={handleSeed} disabled={seedLoading} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50">{seedLoading ? 'Seeding…' : 'Seed sample 101'} <Database className="w-3.5 h-3.5" /></button>
                {seedResult && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-lg">{seedResult}</div>}
                <div className="text-xs text-slate-500">Already have customers? Sample appends, never drops.</div>
              </div>
            </Card>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="border border-slate-200 bg-white px-3 py-2 rounded-lg text-xs hover:bg-slate-50">← Back</button>
            <button onClick={() => setStep(3)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs hover:bg-slate-800">Next: Telemetry →</button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <SectionHeader title="Step 3 — Telemetry (optional)" subtitle="Bulk events or go straight to investigation. Every event triggers reassessment." icon={Zap} />
          <div className="space-y-3 text-sm">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="font-semibold text-amber-900">You can skip this — investigate with just customers.</div>
              <div className="text-amber-800 mt-1">For richest signal, bulk-upload historical telemetry: <code className="bg-white px-1 rounded">POST /customers/{"{id}"}/events/bulk {"{"}events: [{"{"}event_type, payload, timestamp{"}"}]{"}"}</code> (max 200/events). Or use Customer 360 → Inject Live Data after.</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="border border-slate-200 rounded-lg p-2.5 text-center"><div className="font-semibold">USAGE_EVENT</div><div className="text-slate-500 mt-1 font-mono">{"{"}daily_active_users, license_utilization{"}"}</div></div>
              <div className="border border-slate-200 rounded-lg p-2.5 text-center"><div className="font-semibold">SUPPORT_TICKET</div><div className="text-slate-500 mt-1 font-mono">{"{"}severity, subject, description{"}"}</div></div>
              <div className="border border-slate-200 rounded-lg p-2.5 text-center"><div className="font-semibold">CUSTOMER_FEEDBACK</div><div className="text-slate-500 mt-1 font-mono">{"{"}sentiment, text, score{"}"}</div></div>
            </div>
            <details><summary className="text-xs font-mono text-slate-600 cursor-pointer">Example bulk payload</summary><pre className="text-xs bg-slate-950 text-slate-200 rounded p-2 mt-1 overflow-auto">{`{
  "events": [
    {"event_type":"USAGE_EVENT","payload":{"daily_active_users":12,"license_utilization":0.18,"feature_clicks":22},"timestamp":"2026-08-30T10:00:00Z"},
    {"event_type":"SUPPORT_TICKET","payload":{"severity":"CRITICAL","subject":"Export fails","status":"OPEN"}},
    {"event_type":"CUSTOMER_FEEDBACK","payload":{"sentiment":"NEGATIVE","text":"Workflow broken","score":2}}
  ]
}`}</pre></details>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="border border-slate-200 bg-white px-3 py-2 rounded-lg text-xs hover:bg-slate-50">← Back</button>
              <button onClick={() => setStep(4)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700">Skip to Done →</button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <Card>
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-semibold mt-3">Ready to investigate</h3>
            <p className="text-sm text-slate-600 mt-1 max-w-[520px] mx-auto">Go to <b>Command Center</b> → choose any customer → <b>Customer 360 → Run investigation</b>. Every report is evidence-grounded and tenant-isolated.</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => { onComplete?.(); }} className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800"><ExternalLink className="w-4 h-4" />Go to Command Center</button>
              <button onClick={() => setStep(2)} className="border border-slate-200 bg-white px-4 py-2.5 rounded-lg text-xs hover:bg-slate-50">Add more customers</button>
            </div>
            <div className="mt-3 text-xs text-slate-500">Tip: Settings → health weights / LLM / prompts are per-org.</div>
          </div>
        </Card>
      )}
    </div>
  );
};
