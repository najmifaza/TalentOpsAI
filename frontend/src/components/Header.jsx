import React, { useState, useEffect } from 'react';
import { Building2, ExternalLink, Menu, Circle, Sparkles, RefreshCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

export default function Header({ currentTitle = "Dashboard & Triage", onActionClick, onToggleMobileMenu }) {
  const [apiStatus, setApiStatus] = useState('checking'); // 'ok' | 'error' | 'checking'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
      setApiStatus(res.ok ? 'ok' : 'error');
    } catch {
      setApiStatus('error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none border-b border-slate-200/80 transition-colors">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Drawer Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Buka navigasi menu"
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Logo from /logo.svg */}
        <div className="flex items-center gap-3">
          <img 
            src="/logo.svg" 
            alt="TalentOps AI" 
            className="h-8 w-auto object-contain cursor-pointer"
            onClick={() => window.location.href = '/dashboard'}
          />
          <div className="h-4 w-px bg-slate-200 hidden md:block" />
          <span className="text-xs font-medium text-slate-500 hidden md:inline-block">
            {currentTitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Real-time API Health Pill */}
        <button
          type="button"
          onClick={checkHealth}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 text-slate-600 transition-all"
          title="Klik untuk cek status API"
        >
          <Circle className={`w-2 h-2 fill-current ${
            apiStatus === 'ok' ? 'text-emerald-500' :
            apiStatus === 'error' ? 'text-rose-500' : 'text-amber-400'
          }`} />
          <span className="hidden sm:inline">
            {apiStatus === 'ok' ? 'API Terhubung' : apiStatus === 'error' ? 'API Offline' : 'Menghubungkan...'}
          </span>
          <RefreshCw className={`w-3 h-3 text-slate-400 ml-0.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Organization Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100/80 text-slate-700 border border-slate-200/80">
          <Building2 className="w-3.5 h-3.5 text-[#1b55f5]" />
          <span>PT Solusi Digital</span>
        </div>

        {/* Portal Pelamar CTA */}
        <button
          onClick={onActionClick || (() => window.open('/careers/apply', '_blank'))}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b55f5] hover:bg-[#1545c7] active:scale-98 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
          aria-label="Buka Portal Pelamar Publik di tab baru"
        >
          <span>Portal Pelamar</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </header>
  );
}
