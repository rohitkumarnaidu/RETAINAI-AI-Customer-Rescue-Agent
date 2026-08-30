import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, BarChart3, Mail, Users, Shield, Bot, Activity, Trash2, Clock, Zap, ArrowRight } from 'lucide-react';
import { sendChat, streamChat, getChatConversations, getChatMessages, deleteChatConversation, getCustomers } from '../services/api';
import { Card, SectionHeader } from './ui';
import ReactMarkdown from 'react-markdown';

const AGENTS = [
  { id:'usage', label:'Usage Analyst', desc:'DAU, WAU, license', color:'bg-amber-500', icon: BarChart3 },
  { id:'support', label:'Support Analyst', desc:'Tickets, severity', color:'bg-red-500', icon: Mail },
  { id:'sentiment', label:'Sentiment Analyst', desc:'NPS, feedback', color:'bg-violet-500', icon: Users },
  { id:'memory', label:'Memory Analyst', desc:'Past patterns', color:'bg-emerald-500', icon: Sparkles },
  { id:'risk', label:'Risk Analyst', desc:'Health, signals', color:'bg-slate-700', icon: Shield },
];

export const ChatView: React.FC<{ onSelectCustomer?:(id:string)=>void }> = ({onSelectCustomer})=>{
  const [customerId, setCustomerId]=useState<string>('');
  const [customers, setCustomers]=useState<any[]>([]);
  const [messages, setMessages]=useState<{role:'user'|'assistant', content:string, evidence_ids?:string[], traces?:any[]}[]>([]);
  const [input, setInput]=useState('');
  const [loading,setLoading]=useState(false);
  const [streamingText,setStreamingText]=useState('');
  const [specialists,setSpecialists]=useState<Record<string,string>>({});
  const [active,setActive]=useState<Record<string,boolean>>({});
  const [conversationId,setConversationId]=useState<string|undefined>();
  const [conversations,setConversations]=useState<any[]>([]);
  const [error,setError]=useState<string|null>(null);
  const bottomRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages, streamingText]);
  useEffect(()=>{
    (async()=>{
      try{
        const cs=await getCustomers();
        setCustomers(cs);
        if(cs.length && !customerId) setCustomerId(cs[0].id);
      }catch{}
    })();
  },[]);
  useEffect(()=>{ refreshConvs(); },[customerId]);
  const refreshConvs=async()=>{
    try{ const c=await getChatConversations(customerId||undefined); setConversations(c);}catch{}
  };
  const loadConv=async(id:string)=>{
    try{
      const msgs=await getChatMessages(id);
      setConversationId(id);
      setMessages(msgs.map(m=>({role:m.role as any, content:m.content, evidence_ids:undefined, traces:m.agent_traces})));
      setStreamingText(''); setSpecialists({}); setActive({});
      const conv=conversations.find(x=>x.id===id);
      if(conv?.customer_id) setCustomerId(conv.customer_id);
    }catch(e:any){ setError(e.message);}
  };
  const handleDelete=async(id:string)=>{
    await deleteChatConversation(id);
    setConversations(prev=>prev.filter(c=>c.id!==id));
    if(conversationId===id){ setConversationId(undefined); setMessages([]);}
  };
  const send=async(override?:string)=>{
    const q=(override ?? input).trim(); if(!q||loading) return;
    setInput(''); setError(null);
    const hist=[...messages, {role:'user' as const, content:q}].slice(-8).map(m=>({role:m.role, content:m.content}));
    setMessages(prev=>[...prev, {role:'user', content:q}]);
    setLoading(true); setStreamingText(''); setSpecialists({}); setActive({usage:true, support:true, sentiment:true, memory:true, risk:true});
    let acc='';
    try{
      await streamChat({message:q, customer_id: customerId||undefined, conversation_id: conversationId, history: hist.slice(0,-1)}, (evt)=>{
        if(evt.type==='meta' && evt.conversation_id) setConversationId(evt.conversation_id);
        if(evt.type==='specialist' && evt.agent){ setSpecialists(prev=>({...prev, [evt.agent!]: evt.content||''})); setActive(prev=>({...prev, [evt.agent!]: false})); }
        if(evt.type==='token' && evt.content){ acc+=evt.content; setStreamingText(acc); }
        if(evt.type==='error') setError(evt.content||'Stream error');
      });
      if(acc){
        setMessages(prev=>[...prev, {role:'assistant', content: acc}]);
        setStreamingText(''); refreshConvs();
      } else {
        // fallback
        const res=await sendChat({message:q, customer_id: customerId||undefined, conversation_id: conversationId});
        setConversationId(res.conversation_id);
        setMessages(prev=>[...prev, {role:'assistant', content: res.answer, evidence_ids: res.evidence_ids, traces: res.traces}]);
        refreshConvs();
      }
    }catch(e:any){
      try{
        const res=await sendChat({message:q, customer_id: customerId||undefined, conversation_id: conversationId});
        setConversationId(res.conversation_id);
        setMessages(prev=>[...prev, {role:'assistant', content: res.answer, evidence_ids: res.evidence_ids, traces: res.traces}]);
        setStreamingText(''); refreshConvs();
      }catch(e2:any){ setError(e2.message||e.message); setStreamingText(''); }
    } finally{ setLoading(false); setActive({}); }
  };

  const suggestions = customerId ? [
    `Why is ${customers.find(c=>c.id===customerId)?.name||'this customer'} at risk?`,
    `Summarize support tickets and feedback last 30 days`,
    `What retention action do you recommend?`,
    `Show health breakdown and signals`,
  ] : [
    'Which accounts are critical right now?',
    'Summarize at-risk portfolio',
    'What causes churn most often?',
    'Show me evidence grounding',
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Parallel Multi-Agent Chat" subtitle="5 specialists run concurrently (asyncio.gather) → Synthesizer streams tokens. Tenant-isolated, evidence-grounded." icon={Bot}
          action={<span className="text-xs font-mono bg-emerald-500 text-white px-2 py-1 rounded-full">5 agents parallel · SSE</span>}
        />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {AGENTS.map(a=>{
            const Icon=a.icon;
            const isActive=active[a.id];
            const done=!!specialists[a.id] && !isActive;
            return (
              <div key={a.id} className={`border rounded-xl p-2.5 text-center transition ${done?'bg-emerald-50 border-emerald-200': isActive?'bg-amber-50 border-amber-200 animate-pulse':'bg-white border-slate-200'}`}>
                <div className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center ${done?'bg-emerald-500':isActive?'bg-amber-500':'bg-slate-800'} text-white`}>
                  <Icon className="w-3.5 h-3.5"/>
                </div>
                <div className="text-[11px] font-semibold mt-1">{a.label}</div>
                <div className="text-[10px] font-mono text-slate-500">{a.desc}</div>
                <div className={`text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded-full inline-block ${done?'bg-emerald-500 text-white':'bg-slate-100 text-slate-600'}`}>{loading? (done?'done': isActive?'running…':'queued'):'idle'}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="font-mono text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3"/> Parallelism: </span>
          <code className="bg-slate-900 text-slate-200 px-2 py-1 rounded font-mono text-[11px]">await asyncio.gather(usage, support, sentiment, memory, risk)</code>
          <span className="text-slate-500">→</span>
          <code className="bg-slate-100 border border-slate-200 px-2 py-1 rounded font-mono text-[11px]">synthesizer.stream()</code>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: conversations + customer picker */}
        <div className="lg:col-span-1 space-y-3">
          <Card padding="p-3">
            <div className="text-xs font-semibold mb-2">Customer context</div>
            <select value={customerId} onChange={e=>setCustomerId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white">
              <option value="">🌐 Global (no customer)</option>
              {customers.map(c=>(
                <option key={c.id} value={c.id}>{c.name} · {c.risk_level} · {Math.round(c.health_score)}</option>
              ))}
            </select>
            <div className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              {customerId ? 'Chat will be grounded in this customer’s usage, tickets, feedback, signals, memories.' : 'Global chat — no customer grounding, general portfolio Q&A.'}
            </div>
            {customerId && onSelectCustomer && (
              <button onClick={()=>onSelectCustomer(customerId)} className="mt-2 w-full text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1">
                Open 360 <ArrowRight className="w-3 h-3"/>
              </button>
            )}
          </Card>
          <Card padding="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3"/> History ({conversations.length})</div>
              <button onClick={()=>{setConversationId(undefined); setMessages([]); setStreamingText(''); setSpecialists({});}} className="text-[11px] bg-[#0F172A] text-white px-2 py-1 rounded-full">+ New</button>
            </div>
            <div className="space-y-1 max-h-[320px] overflow-auto">
              {conversations.length===0 ? <div className="text-xs text-slate-500 text-center py-6">No chats yet<br/><span className="font-mono text-[11px]">Ask something → new conversation</span></div> : conversations.map((c:any)=>(
                <div key={c.id} onClick={()=>loadConv(c.id)} className={`group border rounded-lg p-2.5 cursor-pointer hover:bg-slate-50 ${conversationId===c.id?'bg-slate-900 text-white border-slate-900 hover:bg-slate-800':'bg-white border-slate-200'}`}>
                  <div className={`text-xs font-medium truncate ${conversationId===c.id?'text-white':'text-slate-900'}`}>{c.title}</div>
                  <div className={`text-[11px] font-mono truncate ${conversationId===c.id?'text-slate-300':'text-slate-500'}`}>{c.customer_id? customers.find(x=>x.id===c.customer_id)?.name||c.customer_id.slice(0,8) : 'global'} · {c.message_count} msgs</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-mono ${conversationId===c.id?'text-slate-400':'text-slate-400'}`}>{c.updated_at? new Date(c.updated_at).toLocaleString(): ''}</span>
                    <button onClick={(e)=>{e.stopPropagation(); handleDelete(c.id);}} className={`p-1 rounded hover:bg-white/10 ${conversationId===c.id?'text-slate-300':'text-slate-400 hover:text-red-600'}`}><Trash2 className="w-3 h-3"/></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {Object.keys(specialists).length>0 && (
            <Card padding="p-3">
              <div className="text-xs font-semibold mb-2">Latest specialist outputs</div>
              <div className="space-y-1.5 max-h-64 overflow-auto">
                {Object.entries(specialists).map(([k,v])=>(
                  <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <div className="text-[11px] font-semibold uppercase text-slate-700">{k}</div>
                    <div className="text-xs text-slate-600 leading-relaxed mt-0.5">{v.slice(0,280)}{v.length>280?'…':''}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Main chat */}
        <div className="lg:col-span-3 flex flex-col h-[640px] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0F172A] flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white"/></div>
              <div>
                <div className="text-sm font-semibold leading-none">{customerId ? customers.find(c=>c.id===customerId)?.name||'Customer chat' : 'Global chat'}</div>
                <div className="text-[11px] font-mono text-slate-500">{conversationId? conversationId.slice(0,16)+'…' : 'new conversation'} · 5 agents · SSE stream</div>
              </div>
            </div>
            <div className="text-[11px] font-mono bg-emerald-500 text-white px-2 py-1 rounded-full">{loading?'streaming…':'ready'}</div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3 bg-[#F8F7F5]">
            {messages.length===0 && !streamingText && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-500"/> Try asking</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {suggestions.map(s=>(
                      <button key={s} onClick={()=>setInput(s)} className="text-left text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 hover:bg-slate-50 leading-relaxed">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-mono text-center">5 analysts run in parallel → synthesizer streams. Evidence IDs cited.</div>
              </div>
            )}
            {messages.map((m,i)=>(
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed overflow-hidden break-words ${m.role==='user'?'bg-[#0F172A] text-white rounded-br-sm whitespace-pre-wrap':'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'}`}>
                  {m.role==='user' ? m.content : (
                    <div className="markdown break-words [&_p]:my-1.5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-2 [&_li]:my-0.5 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_code]:break-all [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-auto [&_pre]:my-2 [&_pre]:text-xs">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                  {m.evidence_ids && m.evidence_ids.length>0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.evidence_ids.map(id=> <span key={id} className="text-[10px] font-mono bg-slate-900 text-white px-1.5 py-0.5 rounded-full">{id.slice(0,12)}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[78%] bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm overflow-hidden break-words">
                  <div className="markdown break-words [&_p]:my-1.5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_code]:break-all [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-auto">
                    <ReactMarkdown>{streamingText}</ReactMarkdown><span className="inline-block w-1.5 h-3 bg-slate-900 ml-1 animate-pulse align-middle"/>
                  </div>
                </div>
              </div>
            )}
            {loading && !streamingText && (
              <div className="flex gap-1 items-center text-xs text-slate-500 px-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"/> <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse delay-75"/> <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse delay-150"/> 5 agents thinking in parallel…
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">{error}</div>}
            <div ref={bottomRef}/>
          </div>

          <div className="p-3 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }}}
                placeholder={customerId ? `Ask about ${customers.find(c=>c.id===customerId)?.name||'customer'}…` : 'Ask about portfolio, health, churn…'}
                rows={1}
                className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400 max-h-24"
                style={{minHeight:'44px'}}
              />
              <button onClick={send} disabled={loading||!input.trim()} className="w-11 h-11 rounded-xl bg-[#0F172A] text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 shrink-0">
                <Send className="w-4 h-4"/>
              </button>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1.5 flex justify-between">
              <span>Enter to send · Shift+Enter newline</span>
              <span>{conversationId? conversationId.slice(0,12):'new conv'} · streaming</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
