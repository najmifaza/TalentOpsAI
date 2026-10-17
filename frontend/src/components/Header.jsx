import React from 'react';
import HealthStatusBadge from './HealthStatusBadge';
import { Bell, Sparkles, Building2 } from 'lucide-react';

export default function Header({ currentTitle = "HR Recruiter Triage Dashboard" }) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0E131F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>{currentTitle}</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              v2.5.2
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Autonomous Candidate Screening & Ethical Triage Engine
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Walking Skeleton Health Status Badge */}
        <HealthStatusBadge />

        <div className="h-5 w-px bg-slate-800"></div>

        {/* Tenant / Organization */}
        <div className="flex items-center gap-2 text-xs text-slate-300 px-2.5 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">PT Solusi Digital Nusantara</span>
        </div>

        {/* Recruiter Avatar */}
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white shadow-inner">
            HR
          </div>
        </div>
      </div>
    </header>
  );
}
