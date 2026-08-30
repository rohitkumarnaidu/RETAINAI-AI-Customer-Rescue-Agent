import React from 'react';

interface RiskBadgeProps {
  level: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, size = 'md' }) => {
  const upperLevel = level ? level.toUpperCase() : 'HEALTHY';

  let colorClasses = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50';
  let dotColor = 'bg-emerald-500';

  if (upperLevel === 'CRITICAL' || upperLevel === 'HIGH') {
    colorClasses = 'bg-rose-950/80 text-rose-400 border-rose-800/50';
    dotColor = 'bg-rose-500';
  } else if (upperLevel === 'WATCH' || upperLevel === 'MEDIUM') {
    colorClasses = 'bg-amber-950/80 text-amber-400 border-amber-800/50';
    dotColor = 'bg-amber-500';
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs border',
    md: 'px-2.5 py-1 text-xs border',
    lg: 'px-3 py-1.5 text-sm border font-medium',
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${sizeClasses} ${colorClasses} font-mono tracking-wider`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor} animate-pulse`} />
      {upperLevel}
    </span>
  );
};
