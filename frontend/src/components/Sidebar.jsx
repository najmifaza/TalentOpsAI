import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Briefcase, ExternalLink, X, FileCheck2, ChevronRight, CalendarDays } from 'lucide-react';
import { getUser } from '../lib/api';
import { roleLabel } from '../lib/roles';

export default function Sidebar({ isOpenMobile = false, onCloseMobile = () => {} }) {
  // Identity comes from the stored session; the Header already reads it, and a
  // hardcoded name here made the sidebar disagree with the rest of the shell.
  const user = getUser();
  const initials = (user?.username || 'HR').slice(0, 2).toUpperCase();

  const menuItems = [
    { path: '/admin/dashboard', label: 'Dashboard & Antrean Berkas', sublabel: 'Antrean & Evaluasi AI', icon: LayoutDashboard },
    { path: '/admin/jobs', label: 'Kelola Lowongan', sublabel: 'Bobot 4D & Kriteria', icon: Briefcase },
    { path: '/admin/calendar', label: 'Kalender', sublabel: 'Google Calendar OAuth', icon: CalendarDays },
  ];

  const handleLinkClick = () => { if (onCloseMobile) onCloseMobile(); };

  const navContent = (
    <div className="flex flex-col h-full bg-primary-black text-white">
      {/* Brand Header */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <Link to="/admin/dashboard" onClick={handleLinkClick} className="flex flex-col gap-1 min-w-0">
          <img src="/logo.svg" alt="TalentOps AI" className="h-7 w-auto object-contain brightness-0 invert" />
          <p className="text-[10px] text-primary-slate-400 font-medium font-jkt tracking-wider uppercase pl-0.5">Recruiter Workspace</p>
        </Link>
        <button 
          type="button" 
          onClick={onCloseMobile} 
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.22em] text-white/50 uppercase font-jkt">
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
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group font-jkt ${
                  isActive
                    ? 'bg-primary-orange text-white shadow-lg shadow-primary-orange/25 font-bold'
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-white/90' : 'text-white/50'}`}>
                      {item.sublabel}
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Section: Public Portals */}
        <div className="pt-6 pb-2">
          <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.22em] text-white/50 uppercase font-jkt">
            Akses Publik
          </p>
          <div className="space-y-1">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              onClick={handleLinkClick}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/75 hover:text-white hover:bg-white/10 transition-all group font-jkt"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-white/60 group-hover:text-white" />
                <span>Portal Pelamar (Publik)</span>
              </div>
              <ExternalLink className="w-3 h-3 text-white/60 group-hover:text-white" />
            </a>

            <a
              href="/track"
              target="_blank"
              rel="noreferrer"
              onClick={handleLinkClick}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-white/75 hover:text-white hover:bg-white/10 transition-all group font-jkt"
            >
              <div className="flex items-center gap-3">
                <FileCheck2 className="w-4 h-4 text-white/60 group-hover:text-white" />
                <span>Lacak Status Berkas</span>
              </div>
              <ExternalLink className="w-3 h-3 text-white/60 group-hover:text-white" />
            </a>
          </div>
        </div>
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-orange text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs font-jkt">
            {initials}
          </div>
          <div className="flex-1 min-w-0 font-jkt">
            <p className="text-xs font-bold text-white truncate">{user?.username || 'Sesi aktif'}</p>
            <p className="text-[10px] text-primary-slate-400 truncate">{roleLabel(user?.role)}</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar: Fixed to Viewport Height (sticky top-0 h-screen) */}
      <aside className="hidden lg:flex w-64 flex-col shrink-0 h-screen sticky top-0 border-r border-primary-border-200 z-20 overflow-hidden">
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
