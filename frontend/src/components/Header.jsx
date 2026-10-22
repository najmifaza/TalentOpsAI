import React, { useState, useEffect } from 'react';
import { Building2, ExternalLink, Menu, Circle, RefreshCw, LogOut } from 'lucide-react';
import { getUser, logout } from '../lib/api';
import { roleLabel } from '../lib/roles';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

export default function Header({ currentTitle = "Dashboard & Antrean Berkas", onActionClick, onToggleMobileMenu }) {
  const [apiStatus, setApiStatus] = useState('checking'); // 'ok' | 'error' | 'checking'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [user] = useState(() => getUser());

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
    const sync = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none border-b border-primary-border-100 transition-colors font-jkt">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Drawer Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Buka navigasi menu"
          className="lg:hidden p-2 rounded-xl text-primary-slate-600 hover:text-primary-black hover:bg-primary-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Brand Logo only (Hidden on desktop because Sidebar already renders logo) */}
        <div className="flex items-center gap-3 lg:hidden">
          <img 
            src="/logo.svg" 
            alt="TalentOps AI" 
            className="h-7 w-auto object-contain cursor-pointer"
            onClick={() => window.location.href = '/admin/dashboard'}
          />
        </div>

        {/* Desktop Breadcrumb / Title */}
        <div className="hidden lg:flex items-center gap-2.5">
          <span className="text-sm font-extrabold text-primary-black font-jkt">
            {currentTitle}
          </span>
          <span className="text-primary-border-200 font-mono text-xs">/</span>
          <span className="text-[11px] font-bold text-primary-slate-500 uppercase tracking-wider">
            Workspace
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Real-time API Health Pill. Hidden while the global offline banner is up:
            two independent "you are offline" signals with different wording was the
            confusing part, not the missing signal. Also hidden below sm, where the
            header row overflowed the viewport at 390px. */}
        <button
          type="button"
          onClick={checkHealth}
          className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-primary-border-200 bg-primary-slate-50 hover:bg-primary-slate-100 text-primary-slate-700 transition-all ${isOffline ? 'sm:hidden' : ''}`}
          title="Klik untuk cek status API"
        >
          <Circle className={`w-2 h-2 fill-current ${
            apiStatus === 'ok' ? 'text-emerald-500' :
            apiStatus === 'error' ? 'text-rose-500' : 'text-primary-orange'
          }`} />
          <span className="hidden sm:inline">
            {apiStatus === 'ok' ? 'API Terhubung' : apiStatus === 'error' ? 'API Offline' : 'Menghubungkan...'}
          </span>
          <RefreshCw className={`w-3 h-3 text-primary-slate-400 ml-0.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Organization Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-slate-100 text-primary-black border border-primary-border-200">
          <Building2 className="w-3.5 h-3.5 text-primary-blue" />
          <span>PT Solusi Digital</span>
        </div>

        {/* Portal Pelamar CTA */}
        <button
          onClick={onActionClick || (() => window.open('/', '_blank'))}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-orange hover:opacity-90 active:scale-98 text-white rounded-full text-xs font-bold shadow-md shadow-primary-orange/25 transition-all shrink-0 font-jkt"
          aria-label="Buka Portal Pelamar Publik di tab baru"
        >
          <span>Portal Pelamar</span>
          <ExternalLink className="w-3 h-3" />
        </button>

        {/* Authenticated session indicator + logout */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-primary-border-100">
          <span className="hidden xl:inline text-[11px] font-semibold text-primary-slate-600">
            {user?.username || 'Sesi aktif'}
            {user?.role ? <span className="text-primary-slate-400"> · {roleLabel(user.role)}</span> : null}
          </span>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl text-primary-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            aria-label="Keluar dari sesi"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
