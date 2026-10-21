import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import { isAuthenticated } from './lib/api';

// Code Splitting via Dynamic Imports (Sprint 5 Vite Optimization)
const JobManagement = lazy(() => import('./components/JobManagement'));
const CareerPortal = lazy(() => import('./components/CareerPortal'));
const LoginPage = lazy(() => import('./components/LoginPage'));
const CalendarPanel = lazy(() => import('./components/CalendarPanel'));
const CandidateDetailPage = lazy(() => import('./components/CandidateDetailPage'));

import { WifiOff, Sparkles } from 'lucide-react';

// Loading Fallback Component with Clean WebEkspor Aesthetics
function ComponentLoader({ label = "Memuat modul komponen..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[350px] space-y-3 font-jkt" role="status" aria-live="polite">
      <div className="relative flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary-orange/20 border-t-primary-orange rounded-full animate-spin"></div>
        <Sparkles className="w-4 h-4 text-primary-orange absolute animate-pulse" />
      </div>
      <p className="text-xs font-bold text-primary-black tracking-wide animate-pulse">
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
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-4 font-jkt">
          <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold">
            !
          </div>
          <div>
            <h3 className="text-base font-extrabold text-primary-black">Terjadi Gangguan Tampilan</h3>
            <p className="text-xs text-primary-slate-600 mt-1 max-w-md">
              {this.state.error?.message || "Komponen mengalami kesalahan saat memuat data."}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-5 py-2.5 bg-primary-orange text-white rounded-full text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-primary-orange/25"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Google redirects back to /admin/dashboard?calendar=<result>; hand the result
  // to the calendar panel instead of dropping it.
  useEffect(() => {
    if (new URLSearchParams(location.search).has('calendar')) {
      navigate(`/admin/calendar${location.search}`, { replace: true });
    }
  }, [location.search, navigate]);

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
    '/admin': 'Dashboard & Triage Antrean',
    '/admin/dashboard': 'Dashboard & Triage Antrean',
    '/admin/jobs': 'Kelola Lowongan & Konfigurasi Bobot 4D',
    '/admin/what-if': 'Kelola Lowongan & Konfigurasi Bobot 4D',
    '/admin/calendar': 'Integrasi Google Calendar',
  };

  const getTitle = () => {
    if (location.pathname.startsWith('/admin/candidates/')) return 'Dossier Kandidat';
    return titles[location.pathname] || 'Dashboard & Triage Antrean';
  };

  const currentTitle = getTitle();

  return (
    <div className="flex min-h-screen bg-primary-slate-50 text-primary-slate-900 font-jkt antialiased selection:bg-primary-orange selection:text-white relative">
      {/* Accessibility Skip Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-5 py-2.5 bg-primary-orange text-white rounded-full shadow-xl font-bold text-xs transition-all"
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

      {/* Main Content Canvas */}
      <div className={`flex-1 flex flex-col min-w-0 ${isOffline ? 'pt-8' : ''}`}>
        <Header 
          currentTitle={currentTitle} 
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)} 
        />

        <main id="main-content" tabIndex="-1" className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto animate-fade-in focus:outline-none">
          <ErrorBoundary>
            <Suspense fallback={<ComponentLoader label="Menginisialisasi modul tampilan..." />}>
              <Routes>
                <Route index element={<DashboardOverview />} />
                <Route path="dashboard" element={<DashboardOverview />} />
                <Route path="jobs" element={<JobManagement />} />
                <Route path="calendar" element={<CalendarPanel />} />
                <Route path="candidates/:id" element={<CandidateDetailPage />} />
                <Route path="what-if" element={<Navigate to="/admin/jobs" replace />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Global Footer (WebEkspor Clean Sub-Footer) */}
        <footer className="border-t border-primary-border-100 bg-white px-4 sm:px-8 py-4 text-xs text-primary-slate-500 transition-colors duration-200 font-jkt">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto text-center sm:text-left">
            <span className="font-semibold text-primary-black">
              TalentOps AI &copy; 2026 &bull; Human-Centric Agentic Recruitment Web Ecosystem
            </span>
            <span className="font-mono text-[11px] text-primary-slate-400 font-medium">
              Production Hardened &bull; React 18 + Vite Code Splitting &bull; WCAG AA Compliant
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Keeps the short /candidates/:id URL working while the page itself lives in the
// authenticated /admin/* shell.
function CandidateAliasRedirect() {
  const { id } = useParams();
  return <Navigate to={`/admin/candidates/${id}`} replace />;
}

function RequireAuth({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
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
          {/* Public Career Portal at Root */}
          <Route path="/" element={<CareerPortal initialTab="apply" />} />
          <Route path="/apply" element={<CareerPortal initialTab="apply" />} />
          <Route path="/track" element={<CareerPortal initialTab="track" />} />
          <Route path="/track/:token" element={<CareerPortal initialTab="track" />} />

          {/* Legacy Career Portal Routes */}
          <Route path="/careers" element={<CareerPortal initialTab="apply" />} />
          <Route path="/careers/apply" element={<CareerPortal initialTab="apply" />} />
          <Route path="/careers/track" element={<CareerPortal initialTab="track" />} />
          <Route path="/careers/track/:token" element={<CareerPortal initialTab="track" />} />

          {/* Internal HR login (public route, no dashboard shell) */}
          <Route path="/admin/login" element={<LoginPage />} />

          {/* Internal HR / Admin Dashboard Routes under /admin/... */}
          <Route path="/admin/*" element={<RequireAuth><DashboardLayout /></RequireAuth>} />

          {/* Candidate dossier deep-link alias: same authed shell as /admin/... */}
          <Route path="/candidates/:id" element={<RequireAuth><CandidateAliasRedirect /></RequireAuth>} />

          {/* Legacy root-level dashboard redirects to /admin/... */}
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/jobs" element={<Navigate to="/admin/jobs" replace />} />
          <Route path="/what-if" element={<Navigate to="/admin/jobs" replace />} />
          <Route path="/evidence-graph" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/evidence-graph/:candidateId" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Catch-all fallback to root Career Portal */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
