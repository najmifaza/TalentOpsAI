import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Building2, ShieldCheck } from 'lucide-react';
import DemoDataBanner from '../DemoDataBanner';
import DpaModal from '../DpaModal';

// Satu-satunya kerangka halaman publik: strip kepatuhan, header, footer.
// Dipakai bersama oleh papan lowongan, detail lowongan, blog, portal lamaran,
// dan pelacakan berkas supaya nav-nya tidak bercabang jadi empat versi.
export default function PublicLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDpaModalOpen, setIsDpaModalOpen] = useState(false);

  const navItems = [
    { label: 'Beranda', to: '/', match: /^\/$/ },
    { label: 'Lowongan', to: '/lowongan', match: /^\/lowongan/ },
    { label: 'Lacak Berkas', to: '/track', match: /^\/(track|careers\/track)/ },
    { label: 'Blog', to: '/blog', match: /^\/blog/ },
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
              <span className="hidden sm:inline">
                <span className="mx-2">&bull;</span>
                Identitas disanitasi sebelum dievaluasi
              </span>
            </p>
          </div>
        </div>
      </section>

      <header className="sticky top-10 z-40 bg-white/95 backdrop-blur-md border-b border-primary-border-100 shadow-xs">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img src="/logo.svg" alt="TalentOps AI" className="h-8 w-auto object-contain" />
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Navigasi portal publik">
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

            <button
              onClick={() => navigate('/admin/dashboard')}
              className="inline-flex items-center gap-1.5 border border-primary-blue bg-white px-2.5 sm:px-3.5 py-2 rounded-md font-semibold text-xs text-primary-blue hover:bg-primary-blue hover:text-white transition-colors shrink-0"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard HR</span>
            </button>
          </div>

          {/* Baris nav terpisah di bawah breakpoint md: empat tab tidak muat
              sebaris dengan logo dan tombol HR pada layar 390px. */}
          <nav
            className="md:hidden flex items-center gap-1 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            aria-label="Navigasi portal publik"
          >
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                  item.match.test(location.pathname)
                    ? 'text-primary-black bg-primary-slate-100'
                    : 'text-primary-slate-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <DemoDataBanner />

      <main className="flex-1">{children}</main>

      <footer className="font-jkt">
        <div className="bg-[#0369a1] py-6 sm:py-8">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div>
                <h3 className="font-jkt font-bold text-lg sm:text-xl text-white">
                  Siap Memulai Karier yang Berkeadilan?
                </h3>
                <p className="font-jkt font-medium text-xs sm:text-sm text-white/90 mt-1">
                  Evaluasi otonom terukur tanpa diskriminasi latar belakang dan demografi.
                </p>
              </div>
              <button
                onClick={() => navigate('/lowongan')}
                className="shrink-0 bg-white px-6 py-3 rounded-full font-jkt font-bold text-xs sm:text-sm text-[#0369a1] hover:bg-white/90 shadow-sm transition-all"
              >
                Pilih Lowongan Sekarang
              </button>
            </div>
          </div>
        </div>

        <div className="bg-primary-slate-1000 py-10 sm:py-12 text-white">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              <div className="space-y-4">
                <img src="/logo.svg" alt="TalentOps AI" className="h-8 w-auto object-contain brightness-0 invert" />
                <p className="text-primary-slate-400 text-xs leading-relaxed font-jkt">
                  Ekosistem seleksi kerja berbasis agen AI otonom dengan standar privasi UU PDP No. 27/2022 dan grafik bukti riil.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-primary-slate-300 font-mono">
                    UINIC 8.0 &bull; GTNIC 2026
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-4 font-jkt">Fitur Utama</h4>
                <ul className="space-y-2 text-xs text-primary-slate-400 font-jkt">
                  <li><Link to="/lowongan" className="hover:text-white transition-colors">Penyaringan Otomatis Deterministik</Link></li>
                  <li><Link to="/lowongan" className="hover:text-white transition-colors">Sanitasi PII In-Memory</Link></li>
                  <li><Link to="/lowongan" className="hover:text-white transition-colors">Audit Portofolio 0 Halusinasi</Link></li>
                  <li><Link to="/lowongan" className="hover:text-white transition-colors">Skoring 4 Dimensi</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-4 font-jkt">Kepatuhan Hukum</h4>
                <ul className="space-y-2 text-xs text-primary-slate-400 font-jkt">
                  <li><span className="text-white">UU PDP No. 27 Tahun 2022</span></li>
                  <li><span>Enkripsi Envelope AES-256</span></li>
                  <li><span>Hak Penghapusan Data (Erasure)</span></li>
                  <li><span>Audit Trail Keamanan ISO 27001</span></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-4 font-jkt">Pusat Bantuan</h4>
                <div className="space-y-2 text-xs text-primary-slate-400 font-jkt">
                  <p className="font-semibold text-white">Tim Rekrutmen TalentOps AI</p>
                  <p>Informatika Universitas Jenderal Soedirman</p>
                  <p className="font-mono text-primary-orange">cs@talentops.ai.id</p>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-primary-slate-400 font-jkt">
              <div>
                &copy; 2026 TalentOps AI &bull; PT Solusi Digital. All rights reserved.
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <button onClick={() => setIsDpaModalOpen(true)} className="hover:text-white transition-colors underline">
                  Ketentuan DPA
                </button>
                <span>&bull;</span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary-orange" />
                  SDG 8: Decent Work &amp; Economic Growth
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <DpaModal isOpen={isDpaModalOpen} onClose={() => setIsDpaModalOpen(false)} />
    </div>
  );
}
