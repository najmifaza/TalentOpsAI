import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';

// Code Splitting via Dynamic Imports (Sprint 5 Vite Optimization)
const EvidenceGraph = lazy(() => import('./components/EvidenceGraph'));
const WhatIfStudio = lazy(() => import('./components/WhatIfStudio'));
const CareerPortal = lazy(() => import('./components/CareerPortal'));

import { WifiOff, Sparkles } from 'lucide-react';

// Loading Fallback Component with Natural Pine & Sage Aesthetics
function ComponentLoader({ label = "Memuat modul komponen..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[350px] space-y-3" role="status" aria-live="polite">
      <div className="relative flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#C2E0C4] border-t-[#0B2B26] rounded-full animate-spin"></div>
        <Sparkles className="w-4 h-4 text-[#235347] absolute animate-pulse" />
      </div>
      <p className="text-xs font-semibold text-[#6C837C] tracking-wide animate-pulse">
        {label}
      </p>
    </div>
  );
}

function DashboardLayout({ isDark, onToggleTheme }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
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
  };

  const getTitle = () => {
    if (location.pathname.startsWith('/evidence-graph')) {
      return 'Evidence Graph Explorer (React Flow)';
    }
    return titles[location.pathname] || 'Dashboard & Triage Queue';
  };

  const currentTitle = getTitle();

  return (
    <div className="flex min-h-screen bg-[#EEF4F0] text-[#0B201B] font-sans antialiased selection:bg-[#8EB69B] selection:text-[#0B201B] relative">
      {/* Accessibility Skip Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#0B2B26] text-white rounded-xl shadow-xl font-semibold text-xs border border-[#8EB69B] transition-all"
      >
        Lewati ke Konten Utama
      </a>

      {/* Edge-Case Alert: Global Offline Status Banner */}
      {isOffline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-xs font-semibold py-2 px-4 flex items-center justify-center gap-2 shadow-md" role="alert">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Koneksi internet terputus. Sistem beralih ke cache data deterministik lokal in-memory.</span>
        </div>
      )}

      {/* Sidebar Navigation (Responsive: Desktop static + Mobile Drawer) */}
      <Sidebar 
        isOpenMobile={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)} 
      />

      {/* Main Content Canvas (Soft Mint-Tinted Off-White #EEF4F0 / Midnight Pine #051F20) */}
      <div className={`flex-1 flex flex-col min-w-0 ${isOffline ? 'pt-8' : ''}`}>
        <Header 
          currentTitle={currentTitle} 
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)} 
        />

        <main id="main-content" tabIndex="-1" className="flex-1 px-4 sm:px-8 py-4 sm:py-6 max-w-7xl w-full mx-auto animate-fade-in focus:outline-none">
          <Suspense fallback={<ComponentLoader label="Menginisialisasi modul tampilan..." />}>
            <Routes>
              <Route index element={<DashboardOverview />} />
              <Route path="dashboard" element={<DashboardOverview />} />
              <Route path="evidence-graph" element={<EvidenceGraph />} />
              <Route path="evidence-graph/:candidateId" element={<EvidenceGraph />} />
              <Route path="what-if" element={<WhatIfStudio />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-[#E1EBE4] dark:border-[#163832] bg-[#EEF4F0]/80 dark:bg-[#072421]/80 px-4 sm:px-8 py-4 text-xs text-[#6C837C] dark:text-[#8EB69B]/80 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto text-center sm:text-left">
            <span className="font-medium">
              TalentOps AI &copy; 2026 &bull; Human-Centric Agentic Recruitment Web Ecosystem
            </span>
            <span className="font-mono text-[11px] text-[#3D544E] font-semibold">
              Production Hardened &bull; React 18 + Vite Code Splitting &bull; WCAG AA Compliant
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  // Enforce pristine Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('talentops-theme');
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<ComponentLoader label="Memuat ekosistem TalentOps AI..." />}>
        <Routes>
          {/* Public Career Portal Routes (Full-screen view) */}
          <Route path="/careers" element={<CareerPortal initialTab="apply" />} />
          <Route path="/careers/apply" element={<CareerPortal initialTab="apply" />} />
          <Route path="/careers/track" element={<CareerPortal initialTab="track" />} />
          <Route path="/careers/track/:token" element={<CareerPortal initialTab="track" />} />

          {/* Internal HR Dashboard Routes */}
          <Route path="/*" element={<DashboardLayout />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

