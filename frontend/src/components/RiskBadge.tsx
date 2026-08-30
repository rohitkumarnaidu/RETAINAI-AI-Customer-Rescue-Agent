import React from 'react';

export const RiskBadge: React.FC<{level:string; size?:'sm'|'md'|'lg'; showDot?:boolean}> = ({level, size='md', showDot=true})=>{
  const u = (level||'HEALTHY').toUpperCase();
  let cls='bg-teal-50 text-teal-700 border-teal-200';
  let dot='bg-teal-500';
  if(['CRITICAL','HIGH_RISK','HIGH'].includes(u)){ cls='bg-red-50 text-red-700 border-red-200'; dot='bg-red-500'; }
  else if(['WATCH','AT_RISK','MEDIUM'].includes(u)){ cls='bg-amber-50 text-amber-700 border-amber-200'; dot='bg-amber-500'; }
  else if(['STABLE','NEUTRAL'].includes(u)){ cls='bg-slate-50 text-slate-700 border-slate-200'; dot='bg-slate-400'; }
  const sz:any = {sm:'text-[11px] px-2 py-0.5', md:'text-xs px-2.5 py-1', lg:'text-sm px-3 py-1'}[size];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono tracking-wide font-medium ${cls} ${sz}`}>{showDot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}{u.replace('_',' ')}</span>;
};

export const HealthRing: React.FC<{score:number; size?:number}> = ({score, size=56})=>{
  const pct = Math.max(0,Math.min(100, score));
  const r=24, circ=2*Math.PI*r, off=circ - (pct/100)*circ;
  let color='#0F766E'; if(pct<50) color='#DC2626'; else if(pct<75) color='#D97706';
  return (
    <div className="relative" style={{width:size,height:size}}>
      <svg width={size} height={size} viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} stroke="#E2E8F0" strokeWidth="6" fill="none" />
        <circle cx="28" cy="28" r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-bold text-slate-900">{Math.round(pct)}</span>
        <span className="text-[9px] text-slate-500 font-mono">HEALTH</span>
      </div>
    </div>
  );
};

export const ConfidenceBadge: React.FC<{confidence:any; uncertainty?:string}> = ({confidence, uncertainty})=>{
  let label='HIGH'; let cls='bg-slate-900 text-white';
  const c = typeof confidence==='number' ? confidence : parseFloat(confidence)||0.85;
  const pct = c<=1 ? Math.round(c*100) : Math.round(c);
  if(uncertainty==='INSUFFICIENT_EVIDENCE' || pct<50){ label='LOW \u00B7 Insufficient evidence'; cls='bg-amber-100 text-amber-800 border border-amber-200'; }
  else if(pct<75){ label='MEDIUM'; cls='bg-slate-100 text-slate-700 border border-slate-200'; }
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label} \u00B7 {pct}%</span>;
};
