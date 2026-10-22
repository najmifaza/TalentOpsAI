import React from 'react';
import { DIMENSIONS, sumPct } from '../lib/dimensions';

// Segmented 4D weight bar + legend. The colours were declared inline in the job
// editor and re-derived differently in the dashboard, so the same dimension had
// two looks. One component now owns both.
export default function WeightBar({ weights, showLegend = true, className = '' }) {
  const total = sumPct(weights);

  return (
    <div className={className}>
      <div
        className="h-2 w-full rounded-full bg-primary-slate-100 overflow-hidden flex"
        role="img"
        aria-label={DIMENSIONS.map((d) => `${d.short} ${weights?.[d.key] ?? 0}%`).join(', ')}
      >
        {DIMENSIONS.map((d) => (
          <div
            key={d.key}
            className={d.bar}
            style={{ width: `${weights?.[d.key] ?? 0}%` }}
            title={`${d.label}: ${weights?.[d.key] ?? 0}%`}
          />
        ))}
      </div>

      {showLegend && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5 text-[11px]">
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="flex items-center gap-1.5 text-primary-slate-600">
              <span className={`w-2 h-2 rounded-full shrink-0 ${d.dot}`} />
              <span>{d.short}: <strong className="tabular-nums">{weights?.[d.key] ?? 0}%</strong></span>
            </div>
          ))}
        </div>
      )}

      {total !== 100 && (
        <p className="mt-2 text-[11px] font-semibold text-amber-700">
          Total bobot {total}% — bukan 100%.
        </p>
      )}
    </div>
  );
}
