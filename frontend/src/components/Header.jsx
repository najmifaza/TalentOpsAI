import React from 'react';
import HealthStatusBadge from './HealthStatusBadge';
import { Building2, Sparkles, ExternalLink, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header({ 
  currentTitle = "Dashboard", 
  onActionClick, 
  onToggleMobileMenu
}) {
  const navigate = useNavigate();

  return (
    <header className="h-16 sm:h-20 bg-white/95 backdrop-blur-sm px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none border-b border-[#e6e6ea] transition-colors duration-200">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Drawer Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Buka navigasi menu"
          className="lg:hidden p-2 rounded-lg bg-white border border-[#d8d8df] text-[#000000] hover:bg-[#eaf0ff] transition-colors shadow-sm"
          title="Buka Navigasi Menu"
        >
          <Menu className="w-5 h-5 text-[#2b2d32]" />
        </button>

        <div>
          <h1 className="text-lg sm:text-2xl font-bold font-display text-[#000000] tracking-tight truncate max-w-[180px] sm:max-w-none">
            {currentTitle}
          </h1>
          <p className="text-[11px] sm:text-xs text-[#67677e] font-medium hidden sm:block">
            Human-Centric Agentic Recruitment & Autonomous Candidate Triage
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Health Status Badge */}
        <HealthStatusBadge />

        {/* Tenant Organization Pill (Hidden on Mobile) */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#454554] px-3 py-1.5 rounded-full bg-white border border-[#e6e6ea] shadow-sm transition-colors duration-200">
          <Building2 className="w-3.5 h-3.5 text-[#1b55f5]" />
          <span className="font-semibold text-[#000000]">PT Solusi Digital</span>
        </div>

        {/* Action Button: Buka Portal Pelamar */}
        <button
          onClick={onActionClick || (() => navigate('/careers/apply'))}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#1b55f5] hover:bg-[#1545c7] text-white rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 shrink-0 btn-interactive"
          aria-label="Buka Portal Pelamar Publik"
          title="Buka Portal Pelamar Publik untuk uji coba pengajuan berkas"
        >
          <ExternalLink className="w-3.5 h-3.5 text-white/90" />
          <span className="hidden sm:inline">Portal Pelamar</span>
          <span className="sm:hidden text-[11px]">Portal</span>
        </button>
      </div>
    </header>
  );
}
