import React from 'react';
import { Search } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Visual indicator shown below the navbar when the user pulls down from the top of the library page.
 */
export default function PullToSearchIndicator({
  pullDistance = 0,
  isPulling = false,
  isThresholdReached = false,
}) {
  const { t } = useI18n();

  if (!isPulling && pullDistance === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="w-full overflow-hidden flex items-center justify-center pointer-events-none select-none transition-[height,opacity] duration-75 ease-out"
      style={{
        height: `${pullDistance}px`,
        opacity: Math.min(1, pullDistance / 25),
      }}
    >
      <div
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all duration-150 ${
          isThresholdReached
            ? 'bg-amber-500 text-neutral-950 scale-105 shadow-amber-500/25'
            : 'bg-neutral-900/90 text-neutral-300 border border-neutral-750 backdrop-blur-sm'
        }`}
      >
        <Search
          className={`w-3.5 h-3.5 transition-transform duration-150 ${
            isThresholdReached ? 'rotate-12 scale-110 text-neutral-950 stroke-[2.5]' : 'text-amber-400'
          }`}
        />
        <span>
          {isThresholdReached
            ? (t('releaseToSearch') || 'Release to search')
            : (t('pullToSearch') || 'Pull down to search')}
        </span>
      </div>
    </div>
  );
}
