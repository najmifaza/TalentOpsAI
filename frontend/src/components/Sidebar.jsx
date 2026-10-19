import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitBranch, 
  Sliders, 
  Briefcase, 
  FileCheck2,
  ExternalLink,
  X
} from 'lucide-react';

export default function Sidebar({ isOpenMobile = false, onCloseMobile = () => {} }) {
  const menuItems = [
    { path: '/dashboard', label: 'Dashboard & Triage', icon: LayoutDashboard, badge: '5 Antrean' },
    { path: '/jobs', label: 'Kelola Lowongan & Bobot', icon: Briefcase, badge: 'Lowongan' },
  ];

  const handleLinkClick = () => {
    if (onCloseMobile) onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full select-none">
      {/* Top Section */}
      <div>
        {/* Brand Header */}
        <div className="p-6 pb-5 flex items-center justify-between border-b border-[#383a42]">
          <Link 
            to="/dashboard" 
            onClick={handleLinkClick}
            className="flex items-center gap-3 hover:opacity-95 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl bg-[#1b55f5] flex items-center justify-center shadow-sm text-white font-extrabold text-base">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white tracking-tight text-lg font-display">TalentOps</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#1b55f5]/30 text-[#8ec0ff] font-semibold border border-[#1b55f5]/50">AI</span>
              </div>
              <p className="text-[10px] text-[#8ec0ff]/80 tracking-wide font-medium">Observability &amp; Triage</p>
            </div>
          </Link>

          {/* Close button for Mobile Drawer */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-[#34373e] transition-colors"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="px-4 py-3 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
            Navigation
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-[#1b55f5] text-white shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-[#34373e]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                      <span className="tracking-tight">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                        isActive ? 'bg-white/20 text-white' : 'bg-black/30 text-white/70'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          <div className="pt-5 px-3 pb-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
            Portal Pelamar Publik
          </div>

          <a
            href="/careers/apply"
            target="_blank"
            rel="noreferrer"
            onClick={handleLinkClick}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-[#34373e] transition-all group"
            title="Buka form pendaftaran pelamar publik di tab baru"
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
              <span className="tracking-tight">Portal Pelamar</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
          </a>

          <a
            href="/careers/track"
            target="_blank"
            rel="noreferrer"
            onClick={handleLinkClick}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-[#34373e] transition-all group"
            title="Buka pelacakan status anonim pelamar di tab baru"
          >
            <div className="flex items-center gap-3">
              <FileCheck2 className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
              <span className="tracking-tight">Lacak Berkas Lamaran</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
          </a>
        </div>
      </div>

      {/* Bottom Section: User Account */}
      <div className="p-4 border-t border-[#383a42]">
        <div className="px-2 pb-2 text-[10px] font-bold tracking-widest text-white/50 uppercase">
          User Account
        </div>
        <div className="p-2.5 rounded-lg bg-[#202226] border border-[#383a42] flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#1b55f5] flex items-center justify-center font-bold text-white text-xs shadow-inner">
              WN
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#202226]"></span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">Willy Narendra</div>
            <div className="text-[10px] text-[#8ec0ff] font-mono truncate">#willy-dev3 &bull; Frontend</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar (Visible on screens >= 1024px) */}
      <aside className="hidden lg:flex w-64 bg-[#2b2d32] text-white flex-col shrink-0 min-h-screen border-r border-[#383a42] select-none transition-colors duration-200">
        {navContent}
      </aside>

      {/* 2. Mobile / Tablet Slide-over Drawer (Visible on screens < 1024px) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true" aria-label="Navigasi Menu Utama">
          {/* Backdrop blur overlay */}
          <div 
            onClick={onCloseMobile}
            className="fixed inset-0 bg-[#000000]/70 backdrop-blur-sm transition-opacity animate-fade-in"
          />

          {/* Drawer Pane */}
          <aside className="relative z-50 w-72 max-w-[80vw] bg-[#2b2d32] text-white flex flex-col h-full shadow-2xl border-r border-[#383a42] animate-slide-in">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
