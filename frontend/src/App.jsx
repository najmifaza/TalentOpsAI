import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import CareerPortal from './components/CareerPortal';
import EvidenceGraph from './components/EvidenceGraph';
import PlaceholderView from './components/PlaceholderView';

function DashboardLayout() {
  const location = useLocation();

  const titles = {
    '/': 'Dashboard & Triage Queue',
    '/dashboard': 'Dashboard & Triage Queue',
    '/evidence-graph': 'Evidence Graph Explorer (React Flow)',
    '/what-if': 'What-If Simulation Studio',
    '/security-pdp': 'UU PDP No. 27/2022 Privacy Governance',
  };

  const currentTitle = titles[location.pathname] || 'Dashboard & Triage Queue';

  return (
    <div className="flex min-h-screen bg-[#EEF4F0] text-[#0B201B] font-sans antialiased selection:bg-[#8EB69B] selection:text-[#051F20]">
      {/* Sidebar Navigation (Forest Green #0B2B26) */}
      <Sidebar />

      {/* Main Content Canvas (Soft Mint-Tinted Off-White #EEF4F0) */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header currentTitle={currentTitle} />

        <main className="flex-1 px-8 py-6 max-w-7xl w-full mx-auto animate-fade-in">
          <Routes>
            <Route index element={<DashboardOverview />} />
            <Route path="dashboard" element={<DashboardOverview />} />
            <Route path="evidence-graph" element={<EvidenceGraph />} />
            <Route path="what-if" element={<PlaceholderView tabId="what-if" />} />
            <Route path="security-pdp" element={<PlaceholderView tabId="security-pdp" />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Career Portal Routes (Full-screen view) */}
        <Route path="/careers" element={<CareerPortal initialTab="apply" />} />
        <Route path="/careers/apply" element={<CareerPortal initialTab="apply" />} />
        <Route path="/careers/track" element={<CareerPortal initialTab="track" />} />
        <Route path="/careers/track/:token" element={<CareerPortal initialTab="track" />} />

        {/* Internal HR Dashboard Routes */}
        <Route path="/*" element={<DashboardLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

