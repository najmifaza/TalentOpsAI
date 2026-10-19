import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';

// Code Splitting via Dynamic Imports (Sprint 5 Vite Optimization)
const EvidenceGraph = lazy(() => import('./components/EvidenceGraph'));
const JobManagement = lazy(() => import('./components/JobManagement'));
const CareerPortal = lazy(() => import('./components/CareerPortal'));

import { WifiOff, Sparkles } from 'lucide-react';

// Loading Fallback Component with Grafana Clean Enterprise Aesthetics
function ComponentLoader({ label = "Memuat modul komponen..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[350px] space-y-3" role="status" aria-live="polite">
      <div className="relative flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#8ec0ff] border-t-[#1b55f5] rounded-full animate-spin"></div>
        <Sparkles className="w-4 h-4 text-[#1b55f5] absolute animate-pulse" />
      </div>
      <p className="text-xs font-semibold text-[#67677e] tracking-wide animate-pulse">
        {label}
      </p>
    </div>
  );
}

// Error Boundary Fallback to prevent blank page
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("UI ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold">
            !
          </div>
          <div>
            <h3 className="text-base font-bold text-[#000000]">Terjadi Gangguan Tampilan</h3>
            <p className="text-xs text-[#67677e] mt-1 max-w-md">
              {this.state.error?.message || "Komponen mengalami kesalahan saat memuat data."}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#1b55f5] text-white rounded-lg text-xs font-semibold hover:bg-[#1545c7] transition-all shadow-xs"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
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
    '/jobs': 'Kelola Lowongan & Konfigurasi Bobot 4D',
    '/what-if': 'Kelola Lowongan & Konfigurasi Bobot 4D',
  };

  const getTitle = () => {
    if (location.pathname.startsWith('/evidence-graph')) {
      return 'Evidence Graph Explorer (React Flow)';
    }
    return titles[location.pathname] || 'Dashboard & Triage Queue';
  };

  const currentTitle = getTitle();

  return (
    <div className="flex min-h-screen bg-[#f4f4f6] text-[#000000] font-sans antialiased selection:bg-[#1b55f5] selection:text-white relative">
      {/* Accessibility Skip Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#1b55f5] text-white rounded-lg shadow-xl font-semibold text-xs transition-all"
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

      {/* Main Content Canvas (Grafana Sunrise Theme) */}
      <div className={`flex-1 flex flex-col min-w-0 ${isOffline ? 'pt-8' : ''}`}>
        <Header 
          currentTitle={currentTitle} 
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)} 
        />

        <main id="main-content" tabIndex="-1" className="flex-1 px-4 sm:px-8 py-5 max-w-7xl w-full mx-auto animate-fade-in focus:outline-none">
          <ErrorBoundary>
            <Suspense fallback={<ComponentLoader label="Menginisialisasi modul tampilan..." />}>
              <Routes>
                <Route index element={<DashboardOverview />} />
                <Route path="dashboard" element={<DashboardOverview />} />
                <Route path="evidence-graph" element={<EvidenceGraph />} />
                <Route path="evidence-graph/:candidateId" element={<EvidenceGraph />} />
                <Route path="jobs" element={<JobManagement />} />
                <Route path="what-if" element={<Navigate to="/jobs" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-[#e6e6ea] bg-white px-4 sm:px-8 py-4 text-xs text-[#67677e] transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto text-center sm:text-left">
            <span className="font-medium text-[#454554]">
              TalentOps AI &copy; 2026 &bull; Human-Centric Agentic Recruitment Web Ecosystem
            </span>
            <span className="font-mono text-[11px] text-[#67677e] font-semibold">
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

