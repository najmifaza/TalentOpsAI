import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  Sliders, 
  ShieldAlert, 
  ExternalLink, 
  Briefcase, 
  Terminal,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard & Triage', icon: LayoutDashboard, badge: '5 Antrean' },
    { id: 'evidence-graph', label: 'Evidence Graph (React Flow)', icon: GitBranch, badge: 'Sprint 2-3' },
    { id: 'what-if', label: 'What-If Simulation Studio', icon: Sliders, badge: 'Sprint 3' },
    { id: 'security-pdp', label: 'UU PDP & Erasure Guard', icon: ShieldAlert, badge: 'AES-256' },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0E131F]/90 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold text-lg">
          TO
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 tracking-tight text-base">TalentOps</span>
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">AI</span>
          </div>
          <p className="text-[10px] text-slate-400 tracking-wide uppercase font-medium">Recruitment Ecosystem</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu HR Recruiter
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-6 px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Portal Publik
        </div>

        <a
          href="#career-portal-preview"
          onClick={(e) => {
            e.preventDefault();
            alert('Public Career Portal (/careers/apply) dijadwalkan pada Sprint 2!');
          }}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent transition-all group"
        >
          <div className="flex items-center gap-3">
            <Briefcase className="w-4 h-4 text-emerald-400" />
            <span>Public Career Portal</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-300" />
        </a>
      </div>

      {/* Developer Sprint Footnote */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Sprint 1 Status:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Skeleton Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Frontend Willy terhubung ke backend live Najmi di VPS.
          </p>
        </div>
      </div>
    </aside>
  );
}
