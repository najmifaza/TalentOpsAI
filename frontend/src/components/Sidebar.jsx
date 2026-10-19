import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Briefcase, ExternalLink, X, FileCheck2, User, ChevronRight } from 'lucide-react';

export default function Sidebar({ isOpenMobile = false, onCloseMobile = () => {} }) {
  const menuItems = [
    { path: '/dashboard', label: 'Dashboard & Triage', sublabel: 'Antrean & Evaluasi AI', icon: LayoutDashboard },
    { path: '/jobs', label: 'Kelola Lowongan', sublabel: 'Bobot 4D & Kriteria', icon: Briefcase },
  ];

  const handleLinkClick = () => { if (onCloseMobile) onCloseMobile(); };

  const navContent = (
    <div className="flex flex-col h-full bg-[#111318] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/6">
        <Link to="/dashboard" onClick={handleLinkClick} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1b55f5] to-[#0d3bb8] flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-tight font-display">TalentOps</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#F49523]/20 text-[#F49523] font-mono font-bold border border-[#F49523]/30">AI</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Recruiter Workspace</p>
          </div>
        </Link>
        <button 
          type="button" 
          onClick={onCloseMobile} 
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          Menu Utama
        </p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-[#1b55f5] text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                      {item.sublabel}
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Section: Public Portals */}
        <div className="pt-6 pb-2">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Akses Publik
          </p>
          <div className="space-y-1">
            <a
              href="/careers/apply"
              target="_blank"
              rel="noreferrer"
              onClick={handleLinkClick}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span>Portal Pelamar</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-white" />
            </a>

            <a
              href="/careers/track"
              target="_blank"
              rel="noreferrer"
              onClick={handleLinkClick}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <FileCheck2 className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span>Lacak Status Berkas</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-white" />
            </a>
          </div>
        </div>
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-white/6">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1b55f5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            WN
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">Willy Narendra</p>
            <p className="text-[10px] text-slate-400 truncate">Frontend Lead</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col shrink-0 min-h-screen border-r border-slate-200/80 z-20">
        {navContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true">
          <div onClick={onCloseMobile} className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" />
          <aside className="relative z-50 w-64 flex flex-col h-full shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
