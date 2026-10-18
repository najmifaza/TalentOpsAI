import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import CareerPortal from './components/CareerPortal';
import EvidenceGraph from './components/EvidenceGraph';
import PlaceholderView from './components/PlaceholderView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const titles = {
    'dashboard': 'Dashboard & Triage Queue',
    'evidence-graph': 'Evidence Graph Explorer (React Flow)',
    'what-if': 'What-If Simulation Studio',
    'security-pdp': 'UU PDP No. 27/2022 Privacy Governance',
    'careers-apply': 'Public Career Portal',
    'careers-track': 'Public Application Tracker',
  };

  // If user is accessing the Public Career Portal, render authentic full-screen public view
  if (activeTab === 'careers-apply' || activeTab === 'careers-track') {
    return (
      <CareerPortal 
        initialTab={activeTab === 'careers-track' ? 'track' : 'apply'}
        onBackToDashboard={() => setActiveTab('dashboard')} 
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#EEF4F0] text-[#0B201B] font-sans antialiased selection:bg-[#8EB69B] selection:text-[#051F20]">
      {/* Sidebar Navigation (Forest Green #0B2B26) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Canvas (Soft Mint-Tinted Off-White #EEF4F0) */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header currentTitle={titles[activeTab]} />

        <main className="flex-1 px-8 py-6 max-w-7xl w-full mx-auto animate-fade-in">
          {activeTab === 'dashboard' ? (
            <DashboardOverview />
          ) : activeTab === 'evidence-graph' ? (
            <EvidenceGraph />
          ) : (
            <PlaceholderView tabId={activeTab} />
          )}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-[#E1EBE4] bg-[#EEF4F0]/80 px-8 py-4 text-xs text-[#6C837C]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <span className="font-medium">
              TalentOps AI &copy; 2026 &bull; Human-Centric Agentic Recruitment Web Ecosystem
            </span>
            <span className="font-mono text-[11px] text-[#3D544E] font-semibold">
              Walking Skeleton &bull; React 18 + Vite &bull; Tailwind CSS &bull; VPS Ubuntu 24.04
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
