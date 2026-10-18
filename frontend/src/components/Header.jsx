import React from 'react';
import HealthStatusBadge from './HealthStatusBadge';
import { Building2, Sparkles, Filter, Plus, Menu, Sun, Moon } from 'lucide-react';

export default function Header({ 
  currentTitle = "Dashboard", 
  onActionClick, 
  onToggleMobileMenu
}) {
  return (
    <header className="h-16 sm:h-20 bg-[#EEF4F0]/95 dark:bg-[#072421]/95 backdrop-blur-sm px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none border-b border-[#E1EBE4]/60 dark:border-[#163832]/60 transition-colors duration-200">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Drawer Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Buka navigasi menu"
          className="lg:hidden p-2 rounded-xl bg-white border border-[#E1EBE4] text-[#0B201B] hover:bg-[#DAF1DE] transition-colors shadow-sm"
          title="Buka Navigasi Menu"
        >
          <Menu className="w-5 h-5 text-[#0B2B26] dark:text-[#8EB69B]" />
        </button>

        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-[#0B201B] tracking-tight truncate max-w-[180px] sm:max-w-none">
            {currentTitle}
          </h1>
          <p className="text-[11px] sm:text-xs text-[#6C837C] dark:text-[#8EB69B]/80 font-medium hidden sm:block">
            Human-Centric Agentic Recruitment & Autonomous Candidate Triage
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark Mode Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? "Beralih ke mode terang (Natural Mint)" : "Beralih ke mode gelap (Deep Midnight Pine)"}
          className="p-2 rounded-xl bg-white dark:bg-[#0B2B26] border border-[#E1EBE4] dark:border-[#163832] text-[#0B201B] dark:text-[#DAF1DE] hover:bg-[#DAF1DE] dark:hover:bg-[#163832] transition-colors shadow-sm btn-interactive"
          title={isDark ? "Beralih ke Mode Terang (Natural Mint)" : "Beralih ke Mode Gelap (Deep Midnight Pine)"}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-[#8EB69B]" />
          ) : (
            <Moon className="w-4 h-4 text-[#235347]" />
          )}
        </button>

        {/* Health Status Badge */}
        <HealthStatusBadge />

        {/* Tenant Organization Pill (Hidden on Mobile) */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#3D544E] dark:text-[#DAF1DE] px-3 py-1.5 rounded-full bg-white dark:bg-[#0B2B26] border border-[#E1EBE4] dark:border-[#163832] shadow-sm transition-colors duration-200">
          <Building2 className="w-3.5 h-3.5 text-[#235347] dark:text-[#8EB69B]" />
          <span className="font-semibold text-[#0B201B] dark:text-[#DAF1DE]">PT Solusi Digital</span>
        </div>

        {/* Action Button */}
        <button
          onClick={onActionClick || (() => alert('[AI Custom Filter]: Pengaturan kriteria seleksi dinamis dibuka.'))}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#0B2B26] hover:bg-[#163832] text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 shrink-0 btn-interactive"
          aria-label="Tambah kriteria filter seleksi AI"
        >
          <Plus className="w-3.5 h-3.5 text-[#8EB69B]" />
          <span className="hidden sm:inline">Tambah Filter AI</span>
          <span className="sm:hidden text-[11px]">Filter</span>
        </button>
      </div>
    </header>
  );
}
