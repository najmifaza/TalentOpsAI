import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import PlaceholderView from './components/PlaceholderView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const titles = {
    'dashboard': 'HR Recruiter Triage Dashboard',
    'evidence-graph': 'Candidate Evidence Graph Explorer',
    'what-if': 'What-If Policy Simulation Studio',
    'security-pdp': 'UU PDP No. 27/2022 Privacy Governance'
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-slate-100 font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header currentTitle={titles[activeTab]} />

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {activeTab === 'dashboard' ? (
            <DashboardOverview />
          ) : (
            <PlaceholderView tabId={activeTab} />
          )}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-800/80 bg-[#0E131F]/50 px-6 py-4 text-center text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <span>
              TalentOps AI &copy; 2026 - Human-Centric Agentic Recruitment Web Ecosystem
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Sprint 1 Walking Skeleton &bull; React 18 + Vite &bull; Tailwind CSS &bull; VPS Ubuntu 24.04
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
