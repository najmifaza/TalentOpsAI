import React from 'react';
import { DIMENSIONS, redistribute, sumPct } from '../lib/dimensions';

// Four sliders whose total is always exactly 100%. Moving one dimension scales the
// other three proportionally, so the number under a slider is both the slider
// position AND the value that gets saved. The previous two screens each did it
// differently (one normalised silently on save, the other showed a normalised
// label against a raw slider position).
export default function WeightSliders({ weights, onChange }) {
  const total = sumPct(weights);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-black">Bobot Dimensi</span>
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full border tabular-nums ${
          total === 100
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : 'bg-amber-50 text-amber-800 border-amber-300'
        }`}>
          Total {total}%
        </span>
      </div>

      {DIMENSIONS.map((d) => (
        <div key={d.key}>
          <div className="flex justify-between text-xs mb-1">
            <label htmlFor={`w-${d.key}`} className="font-semibold text-primary-black flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${d.dot}`} />
              <span>{d.label} <span className="text-primary-slate-400 font-mono text-[10px]">{d.key}</span></span>
            </label>
            <span className={`font-mono font-bold tabular-nums ${d.text}`}>{weights?.[d.key] ?? 0}%</span>
          </div>
          <input
            id={`w-${d.key}`}
            type="range"
            min="0"
            max="100"
            step="1"
            value={weights?.[d.key] ?? 0}
            onChange={(e) => onChange(redistribute(weights, d.key, e.target.value))}
            className="w-full accent-primary-orange cursor-pointer"
          />
        </div>
      ))}
    </div>
  );
}
