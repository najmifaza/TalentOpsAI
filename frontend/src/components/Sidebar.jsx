import React from 'react';
import { 
  LayoutDashboard, 
  GitBranch, 
  Sliders, 
  ShieldAlert, 
  ExternalLink, 
  Briefcase, 
  Sparkles,
  Users,
  Compass,
  FileCheck2
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard & Triage', icon: LayoutDashboard, badge: '5 Antrean' },
    { id: 'evidence-graph', label: 'Evidence Graph (React Flow)', icon: GitBranch, badge: 'Sprint 2-3' },
    { id: 'what-if', label: 'What-If Simulation Studio', icon: Sliders, badge: 'Sprint 3' },
    { id: 'security-pdp', label: 'UU PDP & Erasure Guard', icon: ShieldAlert, badge: 'AES-256' },
  ];

  return (
    <aside className="w-64 bg-[#0B2B26] text-white flex flex-col shrink-0 min-h-screen justify-between border-r border-[#163832]/60 select-none">
      {/* Top Section */}
      <div>
        {/* Brand Header */}
        <div className="p-6 pb-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8EB69B] to-[#235347] flex items-center justify-center shadow-md text-[#051F20] font-extrabold text-base">
            <svg className="w-5 h-5 text-[#051F20]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white tracking-tight text-lg">TalentOps</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#8EB69B]/20 text-[#8EB69B] font-semibold border border-[#8EB69B]/30">AI</span>
            </div>
            <p className="text-[10px] text-[#8EB69B]/70 tracking-wide font-medium">Recruitment Platform</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="px-4 py-3 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-widest text-[#8EB69B]/60 uppercase">
            Navigation
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-[#163832] text-white shadow-sm border border-[#235347]'
                    : 'text-[#DAF1DE]/70 hover:text-white hover:bg-[#163832]/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#8EB69B]' : 'text-[#8EB69B]/70 group-hover:text-[#DAF1DE]'}`} />
                  <span className="tracking-tight">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    isActive ? 'bg-[#8EB69B]/20 text-[#DAF1DE] border border-[#8EB69B]/30' : 'bg-[#051F20]/60 text-[#8EB69B]/80'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-5 px-3 pb-2 text-[10px] font-bold tracking-widest text-[#8EB69B]/60 uppercase">
            Public Portal
          </div>

          <a
            href="#career-portal-preview"
            onClick={(e) => {
              e.preventDefault();
              alert('Public Career Portal (/careers/apply) dijadwalkan pada Sprint 2!');
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#DAF1DE]/70 hover:text-white hover:bg-[#163832]/50 border border-transparent transition-all group"
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-[#8EB69B]" />
              <span className="tracking-tight">Career Apply Portal</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[#8EB69B]/60 group-hover:text-white" />
          </a>
        </div>
      </div>

      {/* Bottom Section: User Account (Inspired by Alex Williamson in Example) */}
      <div className="p-4 border-t border-[#163832]/60">
        <div className="px-2 pb-2 text-[10px] font-bold tracking-widest text-[#8EB69B]/60 uppercase">
          User Account
        </div>
        <div className="p-2.5 rounded-xl bg-[#051F20]/70 border border-[#163832] flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#235347] to-[#8EB69B] flex items-center justify-center font-bold text-white text-xs shadow-inner">
              WN
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#051F20]"></span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">Willy Narendra</div>
            <div className="text-[10px] text-[#8EB69B] font-mono truncate">#willy-dev3 &bull; Frontend</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
