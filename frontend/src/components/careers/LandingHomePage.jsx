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
  Share2
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
    <div className={`${box} rounded-xl bg-primary-black text-white font-extrabold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const closed = new Date(deadline) < new Date();
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${closed ? 'text-rose-600' : 'text-primary-slate-600'}`}>
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
      {/* 1. HERO SECTION (Identik dengan JobBoardPage styling) */}
      <section className="relative bg-primary-black text-white overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-10 bg-dot-matrix pointer-events-none" />
        <div className="relative container mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-14 sm:pt-16 sm:pb-16">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full pl-2 pr-4 py-1.5">
              <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary-orange">
                <ShieldCheck className="size-3.5 text-white" />
              </span>
              <span className="font-semibold text-[11px] tracking-[0.22em] uppercase text-white font-jkt">
                Portal Karier Berkeadilan
              </span>
            </span>

            <h1 className="font-extrabold text-[2rem] sm:text-4xl lg:text-[3rem] leading-[1.18] tracking-tight mt-5 max-w-3xl font-jkt">
              Rekrutmen Talenta Teknologi Berbasis{' '}
              <span className="relative inline-block whitespace-nowrap">
                <span className="relative z-10 italic font-medium">Bukti Nyata</span>
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-0.5 h-2 sm:h-2.5 bg-primary-orange/70 -z-0 -skew-x-6"
                />
              </span>{' '}
              & Integritas Keputusan AI.
            </h1>

            <p className="text-sm sm:text-base text-primary-slate-300 mt-4 max-w-2xl leading-relaxed font-jkt">
              Setiap lamaran disanitasi identitasnya sebelum dievaluasi. Sistem agen cerdas dengan tata kelola manusia mutlak
              (HITL), kepatuhan privasi UU PDP No. 27/2022, dan skor deterministik yang dapat Anda lacak buktinya.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-7">
              <a
                href="#lowongan"
                className="px-6 py-3 rounded-full bg-primary-orange text-white text-xs font-bold hover:opacity-90 shadow-lg shadow-primary-orange/25 transition-all flex items-center gap-2 font-jkt"
              >
                <span>Lihat Lowongan Terbuka</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to="/track"
                className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 font-jkt"
              >
                <span>Lacak Status Berkas</span>
              </Link>
              <Link
                to="/blog"
                className="px-6 py-3 rounded-full text-primary-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1 font-jkt"
              >
                <span>Baca Riset & Blog</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Key Value Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-8 border-t border-white/15">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-primary-orange font-jkt tabular-nums">&le; 15 detik</p>
              <p className="text-[11px] text-primary-slate-300 font-medium mt-1">Penyaringan triage otomatis</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-white font-jkt tabular-nums">100%</p>
              <p className="text-[11px] text-primary-slate-300 font-medium mt-1">Ketertelusuran bukti CV</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-jkt tabular-nums">0 Halusinasi</p>
              <p className="text-[11px] text-primary-slate-300 font-medium mt-1">Skor deterministik 4 dimensi</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <p className="text-2xl sm:text-3xl font-extrabold text-white font-jkt">UU PDP</p>
              <p className="text-[11px] text-primary-slate-300 font-medium mt-1">AES-256-GCM + Crypto-Shredding</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ARSITEKTUR & PILAR NILAI (EXPLANATION SECTION) */}
      <section className="py-12 sm:py-16 bg-white border-b border-primary-border-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-orange/10 text-primary-orange text-xs font-bold font-jkt">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prinsip Kerja Berkeadilan</span>
            </div>
            <h2 className="font-extrabold text-2xl sm:text-3xl text-primary-black tracking-tight font-jkt">
              Mengapa TalentOps AI Berbeda dari ATS Biasa?
            </h2>
            <p className="text-xs sm:text-sm text-primary-slate-600 leading-relaxed font-jkt">
              Menggantikan pencocokan kata kunci statis dan model black-box yang rawan bias dengan arsitektur agen
              beretika, deterministik, dan berlandaskan kepatuhan hukum penuh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl border border-primary-border-200 bg-white hover:border-primary-orange hover:shadow-card-hover transition-all space-y-3 font-jkt">
              <div className="size-11 rounded-xl bg-primary-orange/10 text-primary-orange flex items-center justify-center">
                <EyeOff className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-primary-black">Sanitasi PII In-Memory</h3>
              <p className="text-xs text-primary-slate-600 leading-relaxed">
                Nama, nomor telepon, email, dan asal kampus disanitasi sebelum evaluasi. AI menilai kompetensi tanpa
                dapat melihat atribut demografis kandidat.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl border border-primary-border-200 bg-white hover:border-primary-orange hover:shadow-card-hover transition-all space-y-3 font-jkt">
              <div className="size-11 rounded-xl bg-primary-blue/10 text-primary-blue flex items-center justify-center">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-primary-black">Anti-Halusinasi Substring Guard</h3>
              <p className="text-xs text-primary-slate-600 leading-relaxed">
                Setiap klaim teknologi dan metrik performa dicocokkan verbatim ke dokumen CV asli serta diaudit langsung ke
                repositori GitHub REST API publik.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl border border-primary-border-200 bg-white hover:border-primary-orange hover:shadow-card-hover transition-all space-y-3 font-jkt">
              <div className="size-11 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-primary-black">Skoring 4D Deterministik</h3>
              <p className="text-xs text-primary-slate-600 leading-relaxed">
                LLM murni mengekstrak fakta terstruktur. Nilai akhir dihitung deterministik oleh backend Python pada pilar Skill,
                Experience (non-overlap), Education, dan Portfolio.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl border border-primary-border-200 bg-white hover:border-primary-orange hover:shadow-card-hover transition-all space-y-3 font-jkt">
              <div className="size-11 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-primary-black">Kendali Manusia Mutlak (HITL)</h3>
              <p className="text-xs text-primary-slate-600 leading-relaxed">
                AI tidak pernah mengambil keputusan penolakan atau penerimaan otonom tanpa review manusia. Keputusan akhir selalu
                dikonfirmasi oleh tim HR berwenang.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CARD LOWONGAN KERJA (Identik dengan JobCard JobBoardPage) */}
      <section id="lowongan" className="py-12 sm:py-16 bg-primary-slate-50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold text-primary-orange uppercase tracking-wider block font-jkt mb-1">
                Peluang Karier Aktif
              </span>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-primary-black tracking-tight font-jkt">
                Posisi Lowongan Unggulan
              </h2>
              <p className="text-xs text-primary-slate-600 mt-1 font-jkt">
                Setiap posisi dinilai murni dari kecakapan teknis dan portofolio nyata.
              </p>
            </div>

            <Link
              to="/lowongan"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-black hover:text-primary-orange transition-colors shrink-0 font-jkt"
            >
              <span>Lihat Semua Lowongan ({jobs.length})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingJobs ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-primary-slate-600">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
              <span>Memuat lowongan kerja aktif...</span>
            </div>
          ) : jobsError ? (
            <div className="p-6 rounded-2xl bg-white border border-primary-border-200 text-center space-y-2">
              <p className="text-xs text-rose-600 font-semibold">{jobsError}</p>
              <Link to="/lowongan" className="text-xs text-primary-orange font-bold hover:underline">
                Buka Papan Lowongan
              </Link>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-primary-border-200 text-center space-y-2">
              <Briefcase className="w-6 h-6 text-primary-slate-400 mx-auto" />
              <p className="text-xs font-bold text-primary-black">Belum ada posisi yang aktif saat ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="group bg-white border border-primary-border-200 rounded-2xl p-5 transition-all hover:border-primary-orange hover:shadow-card-hover flex flex-col font-jkt"
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
                      className="flex-1 px-3 py-2 rounded-full border border-primary-border-200 text-xs font-bold text-primary-black hover:border-primary-orange transition-colors text-center"
                    >
                      Lihat Detail
                    </Link>
                    <Link
                      to={`/lowongan/${job.id}/lamar`}
                      className="flex-1 px-3 py-2 rounded-full bg-primary-orange text-white text-xs font-bold hover:opacity-90 shadow-sm shadow-primary-orange/25 transition-all text-center"
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

      {/* 4. CARD BLOG & RISET (Identik dengan BlogFeedPage) */}
      <section id="blog" className="py-12 sm:py-16 bg-white border-t border-primary-border-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold text-primary-orange uppercase tracking-wider block font-jkt mb-1">
                Wawasan & Riset Rekrutmen
              </span>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-primary-black tracking-tight font-jkt">
                Artikel Terbaru TalentOps AI
              </h2>
              <p className="text-xs text-primary-slate-600 mt-1 font-jkt">
                Catatan arsitektur, panduan kepatuhan regulasi, dan eksplorasi etika kecerdasan buatan.
              </p>
            </div>

            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-black hover:text-primary-orange transition-colors shrink-0 font-jkt"
            >
              <span>Buka Blog Lengkap</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingPosts ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-primary-slate-600">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
              <span>Memuat artikel blog...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-primary-slate-50 border border-primary-border-200 text-center space-y-2">
              <BookOpen className="w-6 h-6 text-primary-slate-400 mx-auto" />
              <p className="text-xs font-bold text-primary-black">Nantikan artikel wawasan terbaru segera.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="group bg-white rounded-2xl border border-primary-border-200 overflow-hidden hover:border-primary-orange hover:shadow-card-hover transition-all flex flex-col font-jkt"
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
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] font-bold text-primary-orange uppercase tracking-wider font-jkt">
                      {post.category}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3 font-jkt">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] text-primary-slate-500 mb-1.5 font-jkt">
                        <Clock className="w-3 h-3 text-primary-slate-400" />
                        <span>{post.read_time_minutes} min read</span>
                        <span>&bull;</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                      <Link to={`/blog/${post.slug}`}>
                        <h3 className="font-extrabold text-sm sm:text-base text-primary-black group-hover:text-primary-orange transition-colors leading-snug line-clamp-2 font-jkt">
                          {post.title}
                        </h3>
                      </Link>
                      <p className="text-xs text-primary-slate-600 mt-2 line-clamp-2 leading-relaxed font-jkt">
                        {post.summary}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs font-jkt">
                      <span className="text-[11px] text-primary-slate-500 font-medium">{post.author_name}</span>
                      <Link
                        to={`/blog/${post.slug}`}
                        className="font-bold text-primary-orange hover:underline inline-flex items-center gap-1 font-jkt"
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

      {/* 5. CALL TO ACTION: LACAK BERKAS (Identik dengan dark section) */}
      <section className="py-12 sm:py-16 bg-primary-black text-white">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-3xl border border-white/10 p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-6 bg-white/5 backdrop-blur-xs">
            <div className="space-y-2 max-w-2xl text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-orange uppercase tracking-wider font-jkt">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Transparansi Pelamar 100%
              </span>
              <h2 className="font-extrabold text-xl sm:text-2xl text-white tracking-tight font-jkt">
                Sudah Mengajukan Lamaran di TalentOps AI?
              </h2>
              <p className="text-xs sm:text-sm text-primary-slate-300 leading-relaxed font-jkt">
                Gunakan Secret Tracking Token Anda untuk memantau status antrean seleksi, rincian skor kompetensi 4D, dan alasan
                keputusan evaluasi secara anonim tanpa login.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
              <Link
                to="/track"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-orange text-white text-xs font-bold hover:opacity-90 shadow-lg shadow-primary-orange/25 transition-all text-center font-jkt"
              >
                Lacak Status Sekarang
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
