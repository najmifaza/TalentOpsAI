import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  BookOpen,
  EyeOff,
  Cpu,
  FileCheck,
  CheckCircle2,
  Lock,
  ChevronRight,
  Share2,
  ArrowUpRight,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import PublicLayout from './PublicLayout';
import { API_BASE_URL } from '../../lib/api';
import { formatDate } from '../../lib/format';

const COMPANY_FALLBACK = 'Perusahaan';

function CompanyLogo({ job }) {
  const box = 'w-11 h-11 text-sm';
  if (job.company_logo_url) {
    return (
      <img
        src={job.company_logo_url}
        alt={job.company_name || COMPANY_FALLBACK}
        className={`${box} rounded-xl object-contain border border-primary-border-200 bg-white shrink-0`}
      />
    );
  }
  const initials = (job.company_name || COMPANY_FALLBACK)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`${box} rounded-xl bg-primary-black text-white font-extrabold flex items-center justify-center shrink-0 font-jkt`}>
      {initials}
    </div>
  );
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const closed = new Date(deadline) < new Date();
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold font-jkt ${closed ? 'text-rose-600' : 'text-primary-slate-600'}`}>
      <Clock className="w-3.5 h-3.5" />
      {closed ? 'Batas lamar terlewat' : `Batas Lamar: ${formatDate(deadline)}`}
    </span>
  );
}

export default function LandingHomePage() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState(null);

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Fetch jobs (top 6)
  useEffect(() => {
    let ignore = false;
    fetch(`${API_BASE_URL}/api/careers`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!ignore) {
          const list = json.data && Array.isArray(json.data) ? json.data : [];
          setJobs(list.slice(0, 6));
          setLoadingJobs(false);
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat lowongan di homepage:', err);
        if (!ignore) {
          setJobsError('Gagal memuat lowongan aktif.');
          setLoadingJobs(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Fetch blog posts (top 3)
  useEffect(() => {
    let ignore = false;
    fetch(`${API_BASE_URL}/api/blog?limit=3`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!ignore) {
          setPosts(json.items && Array.isArray(json.items) ? json.items.slice(0, 3) : []);
          setLoadingPosts(false);
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat artikel blog di homepage:', err);
        if (!ignore) {
          setLoadingPosts(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <PublicLayout>
      {/* 1. HERO SECTION (WebEkspor Signature Aesthetics: White Canvas, Dot-Matrix, Watermark, Tangerine Highlight) */}
      <section className="relative overflow-hidden bg-white py-12 sm:py-16 lg:py-20 border-b border-primary-border-100">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #233876 1.2px, transparent 1.2px)',
            backgroundSize: '26px 26px',
          }}
        />

        <div className="relative container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Heading, Value proposition, Callouts, Buttons */}
            <div className="lg:col-span-7 space-y-6 lg:space-y-7 relative">
              <span
                aria-hidden="true"
                className="hidden lg:block absolute -top-16 -left-6 font-jkt font-extrabold text-[200px] leading-none text-primary-slate-100 select-none -z-10 pointer-events-none"
              >
                01
              </span>

              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 bg-primary-orange/10 border border-primary-orange/30 rounded-full pl-2 pr-4 py-1.5">
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary-orange">
                  <Sparkles className="size-3.5 text-white" />
                </span>
                <span className="font-jkt font-semibold text-[11px] tracking-[0.22em] uppercase text-primary-black">
                  Ekosistem Rekrutmen Berkeadilan · UU PDP No. 27/2022
                </span>
              </div>

              {/* Main Headline with WebEkspor Orange Skewed Marker */}
              <h1 className="font-jkt font-extrabold text-[2.25rem] sm:text-5xl lg:text-[3.5rem] text-primary-black leading-[1.05] lg:leading-[3.75rem]">
                Rekrutmen talenta teknologi dengan{' '}
                <span className="relative inline-block whitespace-nowrap">
                  <span className="relative z-10 italic font-medium">bukti nyata</span>
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-1 sm:bottom-2 h-3 sm:h-4 lg:h-5 bg-primary-orange/60 -z-0 -skew-x-6"
                  />
                </span>{' '}
                tanpa bias demografi.
              </h1>

              <p className="font-jkt font-medium text-base lg:text-lg text-primary-slate-700 leading-relaxed max-w-xl">
                Sistem agen rekrutmen cerdas dengan pengawasan manusia mutlak (HITL), kepatuhan privasi enkripsi AES-256-GCM,
                dan kalkulasi skor deterministik 4 dimensi yang 100% dapat diverifikasi ke CV asli.
              </p>

              {/* WebEkspor Metrics / Pricing Strip Style */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-jkt font-semibold text-[11px] tracking-[0.22em] uppercase text-primary-slate-700">
                  Target Triage
                </span>
                <span className="font-jkt font-extrabold text-2xl lg:text-3xl tabular-nums text-primary-black">
                  &le; 15 detik
                </span>
                <span className="bg-primary-orange py-1 px-2.5 font-jkt font-semibold text-[11px] tracking-[0.18em] uppercase text-white rounded">
                  100% Bukti Terverifikasi
                </span>
                <span className="font-jkt font-medium text-xs text-primary-slate-1100">
                  Pangkas waktu HR hingga 80%
                </span>
              </div>

              {/* WebEkspor Pill Button Group */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <a
                  href="#lowongan"
                  className="group inline-flex items-center justify-center gap-2 bg-primary-black text-white px-7 py-3.5 rounded-full font-jkt font-semibold text-sm lg:text-base hover:bg-primary-blue transition-colors duration-300 shadow-md shadow-primary-black/10"
                >
                  <span>Lihat Lowongan Terbuka</span>
                  <span className="w-6 h-6 rounded-full bg-primary-orange flex items-center justify-center group-hover:bg-white transition-colors duration-300">
                    <ArrowRight className="size-3 text-primary-black" />
                  </span>
                </a>
                <Link
                  to="/track"
                  className="inline-flex items-center justify-center gap-2 border-2 border-primary-black text-primary-black px-6 py-[12px] rounded-full font-jkt font-semibold text-sm lg:text-base hover:bg-primary-black hover:text-white transition-colors duration-300"
                >
                  Lacak Status Berkas
                </Link>
              </div>
            </div>

            {/* Right Column: Interactive Trust Card Showcase */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="w-full max-w-md bg-white border border-primary-border-200 rounded-3xl p-6 shadow-card-hover space-y-5 font-jkt relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-orange/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between pb-3 border-b border-primary-border-100">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-primary-orange text-white flex items-center justify-center">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-primary-black">Trust Engine</p>
                      <p className="text-[10px] text-primary-slate-500">Kepatuhan UU PDP No. 27/2022</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                    100% Aktif
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200 flex items-start gap-3">
                    <div className="size-7 rounded-lg bg-primary-orange/10 text-primary-orange flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="size-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-primary-black">Enkripsi Envelope AES-256-GCM</p>
                      <p className="text-[11px] text-primary-slate-600 mt-0.5 leading-relaxed">
                        Data Encryption Key (DEK) unik per kandidat. Identitas terlindungi mutlak dari pembocoran.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200 flex items-start gap-3">
                    <div className="size-7 rounded-lg bg-primary-blue/10 text-primary-blue flex items-center justify-center shrink-0 mt-0.5">
                      <EyeOff className="size-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-primary-black">Sanitasi PII In-Memory Dua Arah</p>
                      <p className="text-[11px] text-primary-slate-600 mt-0.5 leading-relaxed">
                        Nama, nomor telepon, dan almamater disensor sebelum AI menganalisis resume.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200 flex items-start gap-3">
                    <div className="size-7 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Cpu className="size-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-primary-black">Kalkulasi 4D Deterministik</p>
                      <p className="text-[11px] text-primary-slate-600 mt-0.5 leading-relaxed">
                        Skill, Experience non-overlap, Education, dan verifikasi GitHub REST API v3 tanpa halusinasi LLM.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-primary-slate-500">
                  <span className="font-medium">Kompetisi: UINIC 8.0 &bull; GTNIC 2026</span>
                  <span className="font-bold text-primary-orange">Verifikasi Nyata &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ARSITEKTUR & PILAR NILAI (WebEkspor Section 01 Header Pattern) */}
      <section className="relative bg-primary-slate-50 py-12 sm:py-16 overflow-hidden">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-10 lg:mb-14">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-px bg-primary-orange" />
                <span className="font-jkt font-semibold text-[10px] tracking-[0.28em] uppercase text-primary-orange">
                  01 · Pilar Arsitektur &amp; Kepatuhan
                </span>
              </div>
              <h2 className="font-jkt font-extrabold text-3xl sm:text-4xl lg:text-5xl text-primary-black leading-[1.08]">
                Teknologi seleksi <span className="relative inline-block"><span className="relative z-10 italic font-medium">beretika</span><span aria-hidden="true" className="absolute left-0 right-0 bottom-1 sm:bottom-2 h-3 sm:h-4 bg-primary-orange/60 -z-0 -skew-x-6" /></span> dan berlandaskan hukum.
              </h2>
            </div>
            <p className="lg:col-span-4 font-jkt font-medium text-base text-primary-slate-700 leading-relaxed">
              Kami menggantikan pencocokan kata kunci statis dan model black-box yang rawan bias dengan sistem agen
              deterministik berstandar kepatuhan UU PDP No. 27/2022.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {/* Card 1 */}
            <div className="group relative flex flex-col h-full overflow-hidden rounded-2xl border border-primary-border-200 bg-white p-6 transition-colors hover:border-primary-orange/60 shadow-xs font-jkt">
              <div className="size-12 rounded-xl bg-primary-orange/10 flex items-center justify-center mb-5 text-primary-orange">
                <EyeOff className="size-6" />
              </div>
              <span className="font-jkt italic font-medium text-xs text-primary-orange mb-2 block">Kerahasiaan Data</span>
              <h3 className="font-jkt font-bold text-lg text-primary-black mb-2 leading-snug">Sanitasi PII In-Memory</h3>
              <p className="font-jkt font-medium text-sm text-primary-slate-600 leading-relaxed flex-grow">
                Nama, nomor kontak, foto, dan asal kampus disanitasi sebelum evaluasi. AI menilai murni kecakapan teknis
                tanpa pengaruh demografi.
              </p>
              <div className="mt-5 flex items-center justify-between pt-4 border-t border-primary-border-200">
                <span className="font-jkt font-semibold text-[10px] tracking-[0.18em] uppercase text-primary-slate-1100">
                  UU PDP 2022
                </span>
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-primary-border-200 text-primary-slate-1100 transition-all duration-300 group-hover:border-primary-orange group-hover:bg-primary-orange group-hover:text-white">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group relative flex flex-col h-full overflow-hidden rounded-2xl border border-primary-border-200 bg-white p-6 transition-colors hover:border-primary-orange/60 shadow-xs font-jkt">
              <div className="size-12 rounded-xl bg-primary-blue/10 flex items-center justify-center mb-5 text-primary-blue">
                <FileCheck className="size-6" />
              </div>
              <span className="font-jkt italic font-medium text-xs text-primary-blue mb-2 block">Integritas Fakta</span>
              <h3 className="font-jkt font-bold text-lg text-primary-black mb-2 leading-snug">Anti-Halusinasi Substring</h3>
              <p className="font-jkt font-medium text-sm text-primary-slate-600 leading-relaxed flex-grow">
                Setiap klaim teknologi dan metrik performa dicocokkan verbatim ke teks CV asli dan diaudit ke GitHub REST API publik secara real-time.
              </p>
              <div className="mt-5 flex items-center justify-between pt-4 border-t border-primary-border-200">
                <span className="font-jkt font-semibold text-[10px] tracking-[0.18em] uppercase text-primary-slate-1100">
                  Verbatim Guard
                </span>
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-primary-border-200 text-primary-slate-1100 transition-all duration-300 group-hover:border-primary-orange group-hover:bg-primary-orange group-hover:text-white">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group relative flex flex-col h-full overflow-hidden rounded-2xl border border-primary-border-200 bg-white p-6 transition-colors hover:border-primary-orange/60 shadow-xs font-jkt">
              <div className="size-12 rounded-xl bg-emerald-600/10 flex items-center justify-center mb-5 text-emerald-600">
                <Cpu className="size-6" />
              </div>
              <span className="font-jkt italic font-medium text-xs text-emerald-600 mb-2 block">Kalkulasi Presisi</span>
              <h3 className="font-jkt font-bold text-lg text-primary-black mb-2 leading-snug">Skoring 4D Deterministik</h3>
              <p className="font-jkt font-medium text-sm text-primary-slate-600 leading-relaxed flex-grow">
                LLM hanya mengekstrak fakta terstruktur. Skor akhir dihitung deterministik Python pada Skill, Experience non-overlap, Education, dan Portfolio.
              </p>
              <div className="mt-5 flex items-center justify-between pt-4 border-t border-primary-border-200">
                <span className="font-jkt font-semibold text-[10px] tracking-[0.18em] uppercase text-primary-slate-1100">
                  0 Halusinasi
                </span>
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-primary-border-200 text-primary-slate-1100 transition-all duration-300 group-hover:border-primary-orange group-hover:bg-primary-orange group-hover:text-white">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="group relative flex flex-col h-full overflow-hidden rounded-2xl border border-primary-border-200 bg-white p-6 transition-colors hover:border-primary-orange/60 shadow-xs font-jkt">
              <div className="size-12 rounded-xl bg-purple-600/10 flex items-center justify-center mb-5 text-purple-600">
                <ShieldCheck className="size-6" />
              </div>
              <span className="font-jkt italic font-medium text-xs text-purple-600 mb-2 block">Etika &amp; Kontrol</span>
              <h3 className="font-jkt font-bold text-lg text-primary-black mb-2 leading-snug">Supervisi Manusia (HITL)</h3>
              <p className="font-jkt font-medium text-sm text-primary-slate-600 leading-relaxed flex-grow">
                AI tidak pernah menolak atau meloloskan pelamar secara mandiri. Keputusan final persetujuan dan penjadwalan mutlak di tangan rekruter.
              </p>
              <div className="mt-5 flex items-center justify-between pt-4 border-t border-primary-border-200">
                <span className="font-jkt font-semibold text-[10px] tracking-[0.18em] uppercase text-primary-slate-1100">
                  Human Gatekeeper
                </span>
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-primary-border-200 text-primary-slate-1100 transition-all duration-300 group-hover:border-primary-orange group-hover:bg-primary-orange group-hover:text-white">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CARD LOWONGAN KERJA (WebEkspor Section 02 Collection Pattern) */}
      <section id="lowongan" className="relative bg-white py-12 sm:py-16 overflow-hidden border-t border-primary-border-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-8">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-px bg-primary-orange" />
                <span className="font-jkt font-semibold text-[10px] tracking-[0.28em] uppercase text-primary-orange">
                  02 · Peluang Karier Unggulan
                </span>
              </div>
              <h2 className="font-jkt font-extrabold text-3xl sm:text-4xl lg:text-5xl text-primary-black leading-[1.08]">
                Posisi lowongan <span className="relative inline-block"><span className="relative z-10 italic font-medium">siap dilamar</span><span aria-hidden="true" className="absolute left-0 right-0 bottom-1 sm:bottom-2 h-3 sm:h-4 bg-primary-orange/60 -z-0 -skew-x-6" /></span> dengan penilaian transparan.
              </h2>
            </div>
            <div className="lg:col-span-4 flex lg:justify-end">
              <Link
                to="/lowongan"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary-border-200 bg-white font-jkt font-semibold text-xs text-primary-slate-700 hover:border-primary-orange hover:text-primary-orange transition-colors"
              >
                <span>Lihat Semua Lowongan ({jobs.length})</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {loadingJobs ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-primary-slate-600 font-jkt">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
              <span>Memuat lowongan kerja aktif...</span>
            </div>
          ) : jobsError ? (
            <div className="p-6 rounded-2xl bg-primary-slate-50 border border-primary-border-200 text-center space-y-2 font-jkt">
              <p className="text-xs text-rose-600 font-semibold">{jobsError}</p>
              <Link to="/lowongan" className="text-xs text-primary-orange font-bold hover:underline">
                Buka Papan Lowongan
              </Link>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-primary-slate-50 border border-primary-border-200 text-center space-y-2 font-jkt">
              <Briefcase className="w-6 h-6 text-primary-slate-400 mx-auto" />
              <p className="text-xs font-bold text-primary-black">Belum ada posisi yang aktif saat ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="group flex flex-col h-full overflow-hidden rounded-2xl border border-primary-border-200 bg-white p-5 transition-all hover:border-primary-orange hover:shadow-card-hover font-jkt"
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo job={job} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-sm text-primary-black leading-snug line-clamp-2">
                        {job.title}
                      </h3>
                      <p className="text-xs font-semibold text-primary-blue mt-0.5 truncate">
                        {job.company_name || COMPANY_FALLBACK}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.share?.({
                          title: job.title,
                          url: window.location.origin + `/lowongan/${job.id}`,
                        }) || navigator.clipboard?.writeText(window.location.origin + `/lowongan/${job.id}`)
                      }
                      className="p-1.5 rounded-lg text-primary-slate-400 hover:text-primary-orange hover:bg-primary-slate-50 transition-colors shrink-0"
                      title="Bagikan lowongan"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-primary-slate-600 mt-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-primary-slate-400" />
                      {job.job_function || job.department}
                    </span>
                    {job.employment_level && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary-slate-300" />
                        {job.employment_level}
                      </span>
                    )}
                    {job.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary-slate-400" />
                        {job.location}
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <DeadlineBadge deadline={job.deadline} />
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-primary-border-100 mt-auto">
                    <Link
                      to={`/lowongan/${job.id}`}
                      className="flex-1 py-2 rounded-full border border-primary-border-200 text-xs font-bold text-primary-black hover:border-primary-orange transition-colors text-center"
                    >
                      Detail
                    </Link>
                    <Link
                      to={`/lowongan/${job.id}/lamar`}
                      className="flex-1 py-2 rounded-full bg-primary-orange text-white text-xs font-bold hover:opacity-90 shadow-sm shadow-primary-orange/25 transition-all text-center"
                    >
                      Lamar
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. CARD BLOG & RISET (WebEkspor Section 03 Content Pattern) */}
      <section id="blog" className="relative bg-primary-slate-50 py-12 sm:py-16 overflow-hidden border-t border-primary-border-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-8">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-px bg-primary-orange" />
                <span className="font-jkt font-semibold text-[10px] tracking-[0.28em] uppercase text-primary-orange">
                  03 · Wawasan &amp; Riset Rekrutmen
                </span>
              </div>
              <h2 className="font-jkt font-extrabold text-3xl sm:text-4xl lg:text-5xl text-primary-black leading-[1.08]">
                Catatan riset etika AI, <span className="relative inline-block"><span className="relative z-10 italic font-medium">kepatuhan privasi</span><span aria-hidden="true" className="absolute left-0 right-0 bottom-1 sm:bottom-2 h-3 sm:h-4 bg-primary-orange/60 -z-0 -skew-x-6" /></span> &amp; teknologi.
              </h2>
            </div>
            <div className="lg:col-span-4 flex lg:justify-end">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary-border-200 bg-white font-jkt font-semibold text-xs text-primary-slate-700 hover:border-primary-orange hover:text-primary-orange transition-colors"
              >
                <span>Buka Blog Lengkap</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {loadingPosts ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-primary-slate-600 font-jkt">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
              <span>Memuat artikel blog...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-primary-border-200 text-center space-y-2 font-jkt">
              <BookOpen className="w-6 h-6 text-primary-slate-400 mx-auto" />
              <p className="text-xs font-bold text-primary-black">Nantikan artikel wawasan terbaru segera.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="group flex flex-col h-full overflow-hidden rounded-2xl border border-primary-border-200 bg-white transition-all hover:border-primary-orange hover:shadow-card-hover font-jkt"
                >
                  <div className="aspect-video bg-primary-slate-100 overflow-hidden flex items-center justify-center relative">
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <BookOpen className="w-10 h-10 text-primary-slate-300" />
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-xs text-[10px] font-bold text-primary-orange uppercase tracking-wider">
                      {post.category}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] text-primary-slate-500 mb-1.5">
                        <Clock className="w-3 h-3 text-primary-slate-400" />
                        <span>{post.read_time_minutes} min read</span>
                        <span>&bull;</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                      <Link to={`/blog/${post.slug}`}>
                        <h3 className="font-extrabold text-sm sm:text-base text-primary-black group-hover:text-primary-orange transition-colors leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                      </Link>
                      <p className="text-xs text-primary-slate-600 mt-2 line-clamp-2 leading-relaxed">
                        {post.summary}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-primary-slate-500 font-medium">{post.author_name}</span>
                      <Link
                        to={`/blog/${post.slug}`}
                        className="font-bold text-primary-orange hover:underline inline-flex items-center gap-1"
                      >
                        <span>Baca Lengkap</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. SUB-FOOTER ACTION CALLOUT (WebEkspor Signature Ocean Blue Bar #0369a1) */}
      <section className="bg-[#0369a1] py-8 sm:py-10 text-white font-jkt">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="text-center sm:text-left space-y-1">
              <h2 className="font-bold text-lg sm:text-2xl text-white tracking-tight">
                Sudah Mengajukan Berkas Lamaran di TalentOps AI?
              </h2>
              <p className="font-medium text-xs sm:text-sm text-white/90">
                Gunakan Secret Tracking Token untuk melihat transparansi penilaian dan alasan keputusan secara mandiri.
              </p>
            </div>
            <Link
              to="/track"
              className="shrink-0 bg-white px-7 py-3.5 rounded-full font-bold text-xs sm:text-sm text-[#0369a1] hover:bg-white/90 shadow-md transition-all text-center"
            >
              Lacak Status Sekarang
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
