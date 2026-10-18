import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import CareerPortal from './components/CareerPortal';
import EvidenceGraph from './components/EvidenceGraph';
import WhatIfStudio from './components/WhatIfStudio';
import PlaceholderView from './components/PlaceholderView';

import { WifiOff } from 'lucide-react';

function DashboardLayout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const titles = {
    '/': 'Dashboard & Triage Queue',
    '/dashboard': 'Dashboard & Triage Queue',
    '/evidence-graph': 'Evidence Graph Explorer (React Flow)',
    '/what-if': 'What-If Simulation Studio',
    '/security-pdp': 'UU PDP No. 27/2022 Privacy Governance',
  };

  const getTitle = () => {
    if (location.pathname.startsWith('/evidence-graph')) {
      return 'Evidence Graph Explorer (React Flow)';
    }
    return titles[location.pathname] || 'Dashboard & Triage Queue';
  };

  const currentTitle = getTitle();

  return (
    <div className="flex min-h-screen bg-[#EEF4F0] text-[#0B201B] font-sans antialiased selection:bg-[#8EB69B] selection:text-[#051F20] relative">
      {/* Edge-Case Alert: Global Offline Status Banner */}
      {isOffline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-xs font-semibold py-2 px-4 flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Koneksi internet terputus. Sistem beralih ke cache data deterministik lokal in-memory.</span>
        </div>
      )}

      {/* Sidebar Navigation (Responsive: Desktop static + Mobile Drawer) */}
      <Sidebar 
        isOpenMobile={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)} 
      />

      {/* Main Content Canvas (Soft Mint-Tinted Off-White #EEF4F0) */}
      <div className={`flex-1 flex flex-col min-w-0 ${isOffline ? 'pt-8' : ''}`}>
        <Header 
          currentTitle={currentTitle} 
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <main className="flex-1 px-4 sm:px-8 py-4 sm:py-6 max-w-7xl w-full mx-auto animate-fade-in">
          <Routes>
            <Route index element={<DashboardOverview />} />
            <Route path="dashboard" element={<DashboardOverview />} />
            <Route path="evidence-graph" element={<EvidenceGraph />} />
            <Route path="evidence-graph/:candidateId" element={<EvidenceGraph />} />
            <Route path="what-if" element={<WhatIfStudio />} />
            <Route path="security-pdp" element={<PlaceholderView tabId="security-pdp" />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-[#E1EBE4] bg-[#EEF4F0]/80 px-4 sm:px-8 py-4 text-xs text-[#6C837C]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto text-center sm:text-left">
            <span className="font-medium">
              TalentOps AI &copy; 2026 &bull; Human-Centric Agentic Recruitment Web Ecosystem
            </span>
            <span className="font-mono text-[11px] text-[#3D544E] font-semibold">
              Responsive Multi-Device &bull; React 18 + Vite &bull; Tailwind CSS
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

