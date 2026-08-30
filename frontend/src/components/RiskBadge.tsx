import React from 'react';

export const RiskBadge: React.FC<{level:string; size?:'sm'|'md'|'lg'; showDot?:boolean}> = ({level, size='md', showDot=true})=>{
  // Fallback is HEALTHY (not WATCH); callers with truly unknown risk should render "—" instead of invoking RiskBadge — see Customer360.tsx
  const u = (level||'HEALTHY').toUpperCase();
  let cls='bg-teal-50 text-teal-700 border-teal-200';
  let dot='bg-teal-500';
  if(['CRITICAL','HIGH_RISK','HIGH'].includes(u)){ cls='bg-red-50 text-red-700 border-red-200'; dot='bg-red-500'; }
  else if(['WATCH','AT_RISK','MEDIUM'].includes(u)){ cls='bg-amber-50 text-amber-700 border-amber-200'; dot='bg-amber-500'; }
  else if(['STABLE','NEUTRAL'].includes(u)){ cls='bg-slate-50 text-slate-700 border-slate-200'; dot='bg-slate-400'; }
  const sz:any = {sm:'text-xs px-2 py-1', md:'text-xs px-2.5 py-1', lg:'text-sm px-3 py-1'}[size];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono tracking-wide font-medium whitespace-nowrap shrink-0 leading-none ${cls} ${sz}`}>{showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}{u.split('_').join(' ')}</span>;
};

export const HealthRing: React.FC<{score:number; size?:number; hideLabel?:boolean}> = ({score, size=56, hideLabel=false})=>{
  const pct = Math.max(0,Math.min(100, score));
  const r=24, circ=2*Math.PI*r, off=circ - (pct/100)*circ;
  let color='#0F766E'; if(pct<50) color='#DC2626'; else if(pct<75) color='#D97706';
  const isCompact = size <= 40;
  return (
    <div className="relative shrink-0" style={{width:size,height:size}}>
      <svg width={size} height={size} viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} stroke="#E2E8F0" strokeWidth="6" fill="none" />
        <circle cx="28" cy="28" r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={`${isCompact ? 'text-[11px]' : 'text-sm'} font-bold text-slate-900 leading-none`}>{Math.round(pct)}</span>
        {!isCompact && !hideLabel && <span className="text-[9px] text-slate-500 font-mono leading-none mt-0.5">HEALTH</span>}
      </div>
    </div>
  );
};

export const ConfidenceBadge: React.FC<{confidence:any; uncertainty?:string}> = ({confidence, uncertainty})=>{
  // No hardcoded fallback — show — when confidence missing; derive via uncertainty_status when present
  if(confidence==null || confidence==='' || (typeof confidence==='string' && confidence.trim()==='')){
    if(uncertainty==='INSUFFICIENT_EVIDENCE'){
      return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200`}>LOW \u00B7 Insufficient evidence \u00B7 —</span>;
    }
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200`}>\u2014</span>;
  }
  let label='HIGH'; let cls='bg-slate-900 text-white';
  const parsed = typeof confidence==='number' ? confidence : parseFloat(String(confidence));
  const c = Number.isFinite(parsed) ? parsed : NaN;
  if(Number.isNaN(c)){
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200`}>\u2014</span>;
  }
  const pct = c<=1 ? Math.round(c*100) : Math.round(c);
  if(uncertainty==='INSUFFICIENT_EVIDENCE' || pct<50){ label='LOW \u00B7 Insufficient evidence'; cls='bg-amber-100 text-amber-800 border border-amber-200'; }
  else if(pct<75){ label='MEDIUM'; cls='bg-slate-100 text-slate-700 border border-slate-200'; }
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label} \u00B7 {pct}%</span>;
};
