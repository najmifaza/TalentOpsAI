import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Building2, Search, ShieldCheck } from 'lucide-react';

// Kerangka halaman publik: strip kepatuhan, header, footer. Dipakai bersama oleh
// halaman daftar lowongan, detail, dan portal lamaran supaya nav-nya tidak
// bercabang jadi tiga versi.
export default function PublicLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Lowongan', to: '/lowongan', match: /^\/lowongan/ },
    { label: 'Blog', to: '/blog', match: /^\/blog/ },
    { label: 'Lacak Berkas', to: '/track', match: /^\/track/ },
  ];

  return (
    <div className="min-h-screen bg-primary-slate-50 text-primary-slate-900 font-jkt antialiased selection:bg-primary-orange selection:text-white flex flex-col">
      <section className="sticky top-0 z-50">
        <div className="bg-primary-orange min-h-10 flex items-center py-1.5">
          <div className="container mx-auto max-w-7xl px-4 lg:px-6">
            <p className="font-jkt text-[11px] sm:text-sm text-black leading-snug">
              <span className="font-black">UU PDP NO. 27/2022</span>
              <span className="mx-1.5 sm:mx-2">&bull;</span>
              PRIVASI <span className="font-black">100% TERENKRIPSI</span>
              <span className="mx-1.5 sm:mx-2">&bull;</span>
              Identitas disanitasi sebelum dievaluasi
            </p>
          </div>
        </div>
      </section>

      <header className="sticky top-10 z-40 bg-white/95 backdrop-blur-md border-b border-primary-border-100 shadow-xs">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/lowongan" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.svg" alt="TalentOps AI" className="h-8 w-auto object-contain" />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-colors ${
                  item.match.test(location.pathname)
                    ? 'text-primary-black bg-primary-slate-100'
                    : 'text-primary-slate-600 hover:text-primary-black'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/track')}
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-primary-border-200 text-xs font-semibold text-primary-black"
            >
              <Search className="w-3.5 h-3.5 text-primary-orange" />
              Lacak
            </button>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="inline-flex items-center gap-1.5 border border-primary-blue bg-white px-3.5 py-2 rounded-md font-semibold text-xs text-primary-blue hover:bg-primary-blue hover:text-white transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard HR</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-primary-border-100 bg-white py-6">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-primary-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary-orange" />
            Ekosistem seleksi kerja berkeadilan &bull; UU PDP No. 27/2022
          </span>
          <span className="font-mono text-[11px] text-primary-slate-400">
            &copy; 2026 TalentOps AI
          </span>
        </div>
      </footer>
    </div>
  );
}
