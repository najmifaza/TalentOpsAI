import React from 'react';
import HealthStatusBadge from './HealthStatusBadge';
import { Building2, Sparkles, Filter, Plus } from 'lucide-react';

export default function Header({ currentTitle = "Dashboard", onActionClick }) {
  return (
    <header className="h-20 bg-[#EEF4F0] px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0B201B] tracking-tight">
            {currentTitle}
          </h1>
          <p className="text-xs text-[#6C837C] font-medium">
            Human-Centric Agentic Recruitment & Autonomous Candidate Triage
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Walking Skeleton Health Status Badge */}
        <HealthStatusBadge />

        {/* Tenant Organization Pill */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#3D544E] px-3 py-1.5 rounded-full bg-white border border-[#E1EBE4] shadow-sm">
          <Building2 className="w-3.5 h-3.5 text-[#235347]" />
          <span className="font-semibold text-[#0B201B]">PT Solusi Digital</span>
        </div>

        {/* Action Button (Inspired by 'Add Custom Widget' in Reference Image) */}
        <button
          onClick={onActionClick || (() => alert('Fitur kustomisasi widget akan aktif pada Sprint 2.'))}
          className="flex items-center gap-2 px-4 py-2 bg-[#0B2B26] hover:bg-[#163832] text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all duration-200"
        >
          <Plus className="w-3.5 h-3.5 text-[#8EB69B]" />
          <span>Tambah Filter AI</span>
        </button>
      </div>
    </header>
  );
}
