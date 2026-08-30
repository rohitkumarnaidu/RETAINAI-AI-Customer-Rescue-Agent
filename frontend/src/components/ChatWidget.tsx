import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, Zap, Users, BarChart3, Mail, Shield, Trash2, ChevronDown, Bot, Activity, Clock } from 'lucide-react';
import { sendChat, streamChat, getChatConversations, getChatMessages, deleteChatConversation } from '../services/api';
import ReactMarkdown from 'react-markdown';

type Role = 'user' | 'assistant';
type Msg = { id?:string; role: Role; content:string; evidence_ids?:string[]; traces?:any[]; streaming?:boolean };

const AGENTS = [
  { id:'usage', label:'Usage', icon: BarChart3, color:'bg-amber-500' },
  { id:'support', label:'Support', icon: Mail, color:'bg-red-500' },
  { id:'sentiment', label:'Sentiment', icon: Users, color:'bg-violet-500' },
  { id:'memory', label:'Memory', icon: Sparkles, color:'bg-emerald-500' },
  { id:'risk', label:'Risk', icon: Shield, color:'bg-slate-700' },
];

export const ChatWidget: React.FC<{ customerId?:string; customerName?:string }> = ({ customerId, customerName: propName })=>{
  const [open, setOpen]=useState(false);
  const [messages, setMessages]=useState<Msg[]>([]);
  const [input, setInput]=useState('');
  const [loading, setLoading]=useState(false);
  const [resolvedName, setResolvedName]=useState<string|undefined>(propName);
  useEffect(()=>{ setResolvedName(propName); },[propName]);
  useEffect(()=>{
    if(customerId && !propName){
      import('../services/api').then(async({getCustomerById})=>{
        try{ const c=await getCustomerById(customerId); setResolvedName(c.name); }catch{}
      });
    }
    if(!customerId) setResolvedName(undefined);
  },[customerId, propName]);
  const customerName = resolvedName;
  const [streamingText, setStreamingText]=useState('');
  const [specialists, setSpecialists]=useState<Record<string,string>>({});
  const [activeSpecialists, setActiveSpecialists]=useState<Record<string,boolean>>({});
  const [conversationId, setConversationId]=useState<string|undefined>(undefined);
  const [conversations, setConversations]=useState<any[]>([]);
  const [showConvs, setShowConvs]=useState(false);
  const [error, setError]=useState<string|null>(null);
  const [useStream, setUseStream]=useState(true);
  const bottomRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages, streamingText, specialists]);
  useEffect(()=>{ if(open) refreshConvs(); },[open, customerId]);
  const refreshConvs = async()=>{
    try{
      const c=await getChatConversations(customerId);
      setConversations(c);
    }catch{}
  };
  const loadConversation = async(id:string)=>{
    try{
      const msgs=await getChatMessages(id);
      setConversationId(id);
      setMessages(msgs.map(m=>({role:m.role as Role, content:m.content, id:m.id, traces:m.agent_traces})));
      setStreamingText(''); setSpecialists({}); setActiveSpecialists({});
      setShowConvs(false);
    }catch(e:any){ setError(e.message); }
  };
  const handleDelete = async(id:string)=>{
    try{ await deleteChatConversation(id); setConversations(prev=>prev.filter(c=>c.id!==id)); if(conversationId===id){ setConversationId(undefined); setMessages([]);} }catch{}
  };
  const handleNew = ()=>{
    setConversationId(undefined); setMessages([]); setStreamingText(''); setSpecialists({}); setActiveSpecialists({}); setShowConvs(false);
  };

  const send = async(override?:string)=>{
    const q=(override ?? input).trim(); if(!q||loading) return;
    setInput(''); setError(null);
    const userMsg: Msg={role:'user', content:q};
    setMessages(prev=>[...prev, userMsg]);
    setLoading(true); setStreamingText(''); setSpecialists({}); setActiveSpecialists({usage:true, support:true, sentiment:true, memory:true, risk:true});
    // mark all as active then as they complete we'll set false
    const history = [...messages, userMsg].slice(-8).map(m=>({role:m.role, content:m.content}));
    try{
      if(useStream){
        let acc='';
        await streamChat(
          {message:q, customer_id:customerId, conversation_id:conversationId, history: history.slice(0,-1)},
          (evt)=>{
            if(evt.type==='meta'){
              if(evt.conversation_id) setConversationId(evt.conversation_id);
            }
            if(evt.type==='context'){
              // context arrived, keep specialists pulsing
            }
            if(evt.type==='specialist' && evt.agent){
              setSpecialists(prev=>({...prev, [evt.agent!]: evt.content||''}));
              setActiveSpecialists(prev=>({...prev, [evt.agent!]: false}));
            }
            if(evt.type==='token' && evt.content){
              acc+=evt.content;
              setStreamingText(acc);
            }
            if(evt.type==='done'){
              // done
            }
            if(evt.type==='error'){
              setError(evt.content||'Stream error');
            }
          },
          (msg)=> setError(msg)
        );
        if(acc){
          setMessages(prev=>[...prev, {role:'assistant', content: acc }]);
          setStreamingText('');
          refreshConvs();
        } else {
          // fallback to non-stream if no tokens
          throw new Error('No stream tokens, fallback');
        }
      } else {
        const res = await sendChat({message:q, customer_id:customerId, conversation_id:conversationId});
        setConversationId(res.conversation_id);
        setMessages(prev=>[...prev, {role:'assistant', content: res.answer, evidence_ids: res.evidence_ids, traces: res.traces }]);
        // populate specialists from traces
        const spec:Record<string,string>={};
        (res.traces||[]).forEach((t:any)=>{
          if(t.agent && t.output) spec[t.agent.replace('_analyst','')] = t.output;
        });
        setSpecialists(spec);
        setActiveSpecialists({});
        refreshConvs();
      }
    } catch(e:any){
      // fallback non-stream
      if(useStream){
        try{
          const res = await sendChat({message:q, customer_id:customerId, conversation_id:conversationId});
          setConversationId(res.conversation_id);
          setMessages(prev=>[...prev, {role:'assistant', content: res.answer, evidence_ids: res.evidence_ids, traces: res.traces }]);
          setStreamingText('');
          refreshConvs();
        }catch(e2:any){
          setError(e2.message||e.message||'Chat failed');
          setStreamingText('');
        }
      } else {
        setError(e.message||'Chat failed');
      }
    } finally{
      setLoading(false);
      setActiveSpecialists({});
    }
  };

  const handleKey=(e:React.KeyboardEvent)=>{
    if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
  };

  const suggestions = customerId ? [
    `Why is ${customerName||'this customer'} at risk?`,
    `Summarize support tickets for ${customerName||'this account'}`,
    `What did sentiment say last 30 days?`,
    `Recommend next action for ${customerName||'customer'}`,
  ] : [
    'Which accounts are at risk right now?',
    'Summarize high risk customers',
    'What drives churn most commonly?',
    'How does the health engine work?',
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={()=>setOpen(v=>!v)}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all border ${open ? 'bg-white text-slate-900 border-slate-200' : 'bg-[#0F172A] text-white border-[#0F172A] hover:bg-slate-800'}`}
        aria-label="Chat"
      >
        {open ? <X className="w-6 h-6"/> : <><MessageCircle className="w-6 h-6"/><span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"/></>}
      </button>
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[92vw] sm:w-[420px] h-[68vh] sm:h-[560px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Bot className="w-4 h-4"/></div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-none flex items-center gap-1.5">RETAIN<span className="font-normal text-slate-300">AI</span> Chat <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-mono">5 agents parallel</span></div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{customerId ? `${customerName||customerId.slice(0,10)} · streaming` : 'Global · streaming'} · {useStream?'SSE':'JSON'}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={()=>setUseStream(v=>!v)} className={`text-[11px] px-2 py-1 rounded-full border font-mono ${useStream?'bg-emerald-500 border-emerald-500 text-white':'bg-white/10 border-white/20 text-slate-200'}`} title="Toggle streaming">{useStream?'STREAM':'REST'}</button>
              <button onClick={()=>setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg"><X className="w-4 h-4"/></button>
            </div>
          </div>

          {/* Parallel agent bar */}
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3"/> 5 specialists {loading?'· running in parallel…':''}</span>
              <span className="text-[11px] font-mono text-slate-400">{loading?'parallel':'idle'}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {AGENTS.map(a=>{
                const active = activeSpecialists[a.id];
                const done = specialists[a.id] && !active;
                const Icon=a.icon;
                return (
                  <span key={a.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition ${done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : active ? `bg-white border-amber-200 text-amber-700 animate-pulse` : 'bg-white border-slate-200 text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-500' : active ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}/>
                    <Icon className="w-3 h-3"/>{a.label}
                  </span>
                );
              })}
            </div>
            {Object.keys(specialists).length>0 && (
              <details className="mt-2">
                <summary className="text-[11px] font-mono text-slate-600 cursor-pointer">specialist outputs ({Object.keys(specialists).length}/5)</summary>
                <div className="mt-1.5 space-y-1 max-h-28 overflow-auto">
                  {Object.entries(specialists).map(([k,v])=>(
                    <div key={k} className="text-[11px] bg-white border border-slate-200 rounded-lg p-2">
                      <span className="font-semibold uppercase text-slate-700">{k}:</span> <span className="text-slate-600">{v.slice(0,220)}{v.length>220?'…':''}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Conversations bar */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
            <button onClick={handleNew} className="text-xs bg-[#0F172A] text-white px-3 py-1.5 rounded-full font-medium hover:bg-slate-800">+ New</button>
            <button onClick={()=>setShowConvs(v=>!v)} className="text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-full hover:bg-slate-50 flex items-center gap-1">
              <Clock className="w-3 h-3"/> History ({conversations.length}) <ChevronDown className={`w-3 h-3 transition ${showConvs?'rotate-180':''}`}/>
            </button>
            {customerName && <span className="text-[11px] font-mono text-slate-500 truncate ml-auto" title={customerId}>{customerName}</span>}
          </div>
          {showConvs && (
            <div className="border-b border-slate-100 bg-slate-50 max-h-32 overflow-auto shrink-0">
              {conversations.length===0 ? <div className="text-xs text-slate-500 p-3 text-center">No conversations yet</div> : conversations.map((c:any)=>(
                <div key={c.id} className={`flex items-center gap-2 px-3 py-2 hover:bg-white cursor-pointer text-xs border-b border-slate-100 last:border-0 ${conversationId===c.id?'bg-white':''}`} onClick={()=>loadConversation(c.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-slate-900">{c.title}</div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">{c.id.slice(0,14)} · {c.message_count} msgs · {c.customer_id? '👤 '+c.customer_id.slice(0,8): 'global'}</div>
                  </div>
                  <button onClick={(e)=>{e.stopPropagation(); handleDelete(c.id);}} className="p-1 hover:bg-slate-100 rounded"><Trash2 className="w-3 h-3 text-slate-400"/></button>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-auto p-3 space-y-3 bg-[#F8F7F5]">
            {messages.length===0 && !streamingText && !loading && (
              <div className="space-y-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5"><Zap className="w-3.5 h-3 text-amber-500"/> Parallel multi-agent chat</div>
                  <div className="text-xs text-slate-600 mt-1 leading-relaxed">5 specialists (Usage, Support, Sentiment, Memory, Risk) run <b>in parallel</b> via <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">asyncio.gather</code>. Then Synthesizer streams the answer token-by-token.</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">Powered by Groq LPU · tenant-isolated · evidence-grounded</div>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {suggestions.map(s=>(
                    <button key={s} onClick={()=>{ setInput(s); setTimeout(()=> inputRef.current?.focus(), 0); }} className="text-left text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 hover:border-slate-300 leading-relaxed">
                      {s}
                    </button>
                  ))}
                </div>
                {customerId && <div className="text-[11px] text-slate-500 font-mono text-center">Customer context: {customerName||customerId} · evidence will be cited</div>}
              </div>
            )}
            {messages.map((m,idx)=>(
              <div key={idx} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed overflow-hidden break-words ${m.role==='user' ? 'bg-[#0F172A] text-white rounded-br-sm whitespace-pre-wrap' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'}`}>
                  {m.role==='user' ? m.content : (
                    <div className="markdown break-words [&_p]:my-1.5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-2 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_code]:break-all [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-auto [&_pre]:my-2 [&_pre]:text-xs">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                  {m.evidence_ids && m.evidence_ids.length>0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.evidence_ids.slice(0,6).map(id=>(
                        <span key={id} className="text-[10px] font-mono bg-slate-900 text-white px-1.5 py-0.5 rounded-full">{id.slice(0,12)}</span>
                      ))}
                    </div>
                  )}
                  {m.traces && m.traces.length>0 && (
                    <details className="mt-2">
                      <summary className="text-[11px] font-mono text-slate-500 cursor-pointer">traces</summary>
                      <pre className="mt-1 text-[10px] bg-slate-50 border border-slate-200 rounded p-1.5 overflow-auto max-h-28">{JSON.stringify(m.traces.slice(0,3), null, 2)}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[84%] bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed shadow-sm overflow-hidden break-words">
                  <div className="markdown break-words [&_p]:my-1.5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_code]:break-all [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-auto">
                    <ReactMarkdown>{streamingText}</ReactMarkdown><span className="inline-block w-1.5 h-3 bg-slate-900 ml-1 animate-pulse align-middle"/>
                  </div>
                </div>
              </div>
            )}
            {loading && !streamingText && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs text-slate-500 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"/><span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse delay-75"/><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse delay-150"/> 5 agents thinking in parallel…
                </div>
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">{error}</div>}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={customerId ? `Ask about ${customerName||'this customer'}…` : 'Ask anything…'}
                rows={1}
                className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:text-slate-400 max-h-24"
                style={{minHeight: '42px'}}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4"/>
              </button>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1.5 flex items-center justify-between">
              <span>Enter to send · Shift+Enter new line</span>
              <span className="hidden sm:inline">5 parallel · SSE stream</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
