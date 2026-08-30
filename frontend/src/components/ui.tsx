import React from 'react';

export const Card: React.FC<{children:React.ReactNode; className?:string; padding?:string}> = ({children, className='', padding='p-5'})=>(
  <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${padding} ${className}`}>{children}</div>
);
export const SectionHeader: React.FC<{title:string; subtitle?:string; action?:React.ReactNode; icon?:any}> = ({title, subtitle, action, icon:Icon})=>(
  <div className="flex items-start justify-between gap-4 mb-4">
    <div>
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-slate-500"/>}{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);
export const Skeleton: React.FC<{className?:string}> = ({className=''})=> <div className={`skeleton rounded ${className}`} />;
export const SkeletonCard: React.FC = ()=>(
  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
    <Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" />
  </div>
);
export const EmptyState: React.FC<{title:string; description:string; action?:React.ReactNode; icon?:any}> = ({title, description, action, icon:Icon})=>(
  <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
    {Icon && <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3"><Icon className="w-5 h-5 text-slate-400"/></div>}
    <div className="text-sm font-semibold text-slate-900">{title}</div>
    <div className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">{description}</div>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
export const ErrorState: React.FC<{message:string; onRetry?:()=>void}> = ({message, onRetry})=>(
  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
    <span className="w-8 h-8 rounded-full bg-white border border-red-200 flex items-center justify-center shrink-0 text-red-600">!</span>
    <div className="flex-1">
      <div className="text-sm font-semibold text-red-800">Something went wrong</div>
      <div className="text-xs text-red-700 mt-1">{message}</div>
      {onRetry && <button onClick={onRetry} className="mt-2 text-xs font-medium bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">Try again</button>}
    </div>
  </div>
);
export const Pill: React.FC<{children:React.ReactNode; active?:boolean; onClick?:()=>void}> = ({children, active, onClick})=>(
  <button onClick={onClick} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{children}</button>
);
export const EvidenceDrawer: React.FC<{ids:string[]; open:boolean; onClose:()=>void}> = ({ids, open, onClose})=>{
  const [details, setDetails] = React.useState<Record<string,any>>({});
  const [loading, setLoading] = React.useState<string | null>(null);
  React.useEffect(()=>{ if(!open) setDetails({}); },[open]);
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border-l border-slate-200 h-full overflow-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Evidence references</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Each ID links to a real record. Click to resolve.</p>
        <div className="space-y-2">
          {ids.map(id=>(
            <div key={id} className="border border-slate-200 rounded-lg p-3">
              <div className="font-mono text-xs text-slate-900">{id}</div>
              {details[id] ? (
                <pre className="mt-2 text-[11px] bg-slate-50 border border-slate-200 rounded p-2 overflow-auto max-h-40">{JSON.stringify(details[id], null, 2)}</pre>
              ) : (
                <button
                  onClick={async()=>{ setLoading(id); try{ const {resolveEvidence}=await import('../services/api'); const d=await resolveEvidence(id); setDetails(prev=>({...prev,[id]:d})); } catch(e:any){ setDetails(prev=>({...prev,[id]:{error:e.message}})); } finally{ setLoading(null); } }}
                  className="mt-2 text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg hover:bg-slate-800"
                >{loading===id ? 'Resolving…':'Show evidence'}</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
