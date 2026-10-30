import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, Briefcase, Clock, LayoutGrid, List as ListIcon,
  RefreshCw, AlertCircle, Share2, ArrowRight, ShieldCheck
} from 'lucide-react';
import PublicLayout from './PublicLayout';
import { API_BASE_URL } from '../../lib/api';
import { formatDate } from '../../lib/format';

const COMPANY_FALLBACK = 'Perusahaan';

function CompanyLogo({ job, size = 'md' }) {
  const box = size === 'lg' ? 'w-14 h-14 text-base' : 'w-11 h-11 text-sm';
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
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
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

function JobCard({ job, view, onDetail, onApply }) {
  const isList = view === 'list';
  return (
    <article
      className={`group bg-white border border-primary-border-200 rounded-2xl p-5 transition-all hover:border-primary-orange hover:shadow-card-hover ${
        isList ? 'flex flex-col sm:flex-row sm:items-center gap-4' : 'flex flex-col'
      }`}
    >
      <div className={`flex items-start gap-3 ${isList ? 'sm:flex-1 min-w-0' : ''}`}>
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
          onClick={() => navigator.share?.({ title: job.title, url: window.location.origin + `/lowongan/${job.id}` })
            || navigator.clipboard?.writeText(window.location.origin + `/lowongan/${job.id}`)}
          className="p-1.5 rounded-lg text-primary-slate-400 hover:text-primary-orange hover:bg-primary-slate-50 transition-colors shrink-0"
          title="Bagikan lowongan"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-primary-slate-600 ${isList ? 'sm:w-56' : 'mt-3'}`}>
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

      <div className={isList ? 'sm:w-48' : 'mt-2'}>
        <DeadlineBadge deadline={job.deadline} />
      </div>

      <div className={`flex items-center gap-2 ${isList ? 'sm:shrink-0' : 'mt-4 pt-4 border-t border-primary-border-100'}`}>
        <button
          onClick={() => onDetail(job.id)}
          className="flex-1 px-3 py-2 rounded-full border border-primary-border-200 text-xs font-bold text-primary-black hover:border-primary-orange transition-colors"
        >
          Lihat Detail
        </button>
        <button
          onClick={() => onApply(job.id)}
          className="flex-1 px-3 py-2 rounded-full bg-primary-orange text-white text-xs font-bold hover:opacity-90 shadow-sm shadow-primary-orange/25 transition-all"
        >
          Lamar
        </button>
      </div>
    </article>
  );
}

export default function JobBoardPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('grid');
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [jobFunction, setJobFunction] = useState('');
  const [level, setLevel] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/careers`);
        if (!res.ok) throw new Error(`Server merespons ${res.status}`);
        const json = await res.json();
        if (!cancelled) setJobs(json.data || []);
      } catch (err) {
        if (!cancelled) setError('Daftar lowongan gagal dimuat. Periksa koneksi lalu coba lagi.');
        console.warn('Job board fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter di klien: satu kali fetch, hasil instan. Endpoint juga menerima
  // q/company/job_function/employment_level untuk konsumen API lain.
  const options = useMemo(() => ({
    companies: [...new Set(jobs.map((j) => j.company_name).filter(Boolean))].sort(),
    functions: [...new Set(jobs.map((j) => j.job_function || j.department).filter(Boolean))].sort(),
    levels: [...new Set(jobs.map((j) => j.employment_level).filter(Boolean))].sort(),
  }), [jobs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (company && j.company_name !== company) return false;
      if (jobFunction && (j.job_function || j.department) !== jobFunction) return false;
      if (level && j.employment_level !== level) return false;
      if (!needle) return true;
      return [j.title, j.company_name, j.raw_text, j.job_function, j.department]
        .filter(Boolean).some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [jobs, q, company, jobFunction, level]);

  const goDetail = (id) => navigate(`/lowongan/${id}`);
  const goApply = (id) => navigate(`/lowongan/${id}/lamar`);

  return (
    <PublicLayout>
      <section className="relative bg-primary-black text-white overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-10 bg-dot-matrix pointer-events-none" />
        <div className="relative container mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-12">
          <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full pl-2 pr-4 py-1.5">
            <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary-orange">
              <ShieldCheck className="size-3.5 text-white" />
            </span>
            <span className="font-semibold text-[11px] tracking-[0.22em] uppercase text-white">
              Portal Karier Berkeadilan
            </span>
          </span>
          <h1 className="font-extrabold text-[2rem] sm:text-4xl lg:text-[3rem] leading-[1.18] tracking-tight mt-5 max-w-3xl">
            Temukan posisi yang dinilai dari{' '}
            <span className="relative inline-block whitespace-nowrap">
              <span className="relative z-10 italic font-medium">kompetensi</span>
              <span aria-hidden="true" className="absolute left-0 right-0 -bottom-0.5 h-2 sm:h-2.5 bg-primary-orange/70 -z-0 -skew-x-6" />
            </span>{' '}
            nyata, bukan latar belakang.
          </h1>
          <p className="text-sm sm:text-base text-primary-slate-300 mt-4 max-w-2xl leading-relaxed">
            Setiap lamaran disanitasi identitasnya sebelum dievaluasi. Anda bisa melihat skor dan alasan keputusan
            untuk lamaran Anda sendiri.
          </p>
        </div>

        {/* Search bar duduk di bawah hero, bukan mengapung menimpanya:
            posisi absolut dengan inset negatif menutupi headline saat tinggi
            hero berubah, dan kartunya terpotong. */}
        <div className="bg-primary-black pb-10 sm:pb-12">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="bg-white rounded-2xl border border-primary-border-200 shadow-card-hover p-3 sm:p-4">
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-primary-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari lowongan yang Anda inginkan..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary-border-200 bg-primary-slate-50 text-xs text-primary-black placeholder:text-primary-slate-400 focus:bg-white focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
                  />
                </div>
                <select
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="lg:w-48 px-3 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-black focus:outline-none focus:border-primary-orange"
                >
                  <option value="">Semua Perusahaan</option>
                  {options.companies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={jobFunction}
                  onChange={(e) => setJobFunction(e.target.value)}
                  className="lg:w-44 px-3 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-black focus:outline-none focus:border-primary-orange"
                >
                  <option value="">Semua Fungsi</option>
                  {options.functions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="lg:w-44 px-3 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-black focus:outline-none focus:border-primary-orange"
                >
                  <option value="">Semua Jenjang</option>
                  {options.levels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-10 pb-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-primary-border-200">
            <h2 className="font-extrabold text-lg text-primary-black">
              ({filtered.length}) Pekerjaan tersedia
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setView('grid')}
                aria-label="Tampilan grid"
                className={`p-2 rounded-lg border transition-colors ${view === 'grid' ? 'bg-primary-orange border-primary-orange text-white' : 'border-primary-border-200 text-primary-slate-500 hover:border-primary-orange'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                aria-label="Tampilan daftar"
                className={`p-2 rounded-lg border transition-colors ${view === 'list' ? 'bg-primary-orange border-primary-orange text-white' : 'border-primary-border-200 text-primary-slate-500 hover:border-primary-orange'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading && (
            <div className="py-16 flex flex-col items-center gap-2 text-xs text-primary-slate-600">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
              Memuat daftar lowongan...
            </div>
          )}

          {!loading && error && (
            <div className="my-8 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="py-16 text-center space-y-2">
              <Briefcase className="w-7 h-7 text-primary-slate-300 mx-auto" />
              <p className="font-bold text-sm text-primary-black">
                {jobs.length === 0 ? 'Belum ada lowongan aktif' : 'Tidak ada lowongan yang cocok'}
              </p>
              <p className="text-xs text-primary-slate-600 max-w-sm mx-auto">
                {jobs.length === 0
                  ? 'Saat ini tidak ada posisi yang dibuka. Silakan kembali lagi nanti.'
                  : 'Coba ubah kata kunci atau kosongkan filter perusahaan, fungsi, dan jenjang.'}
              </p>
              {jobs.length > 0 && (
                <button
                  onClick={() => { setQ(''); setCompany(''); setJobFunction(''); setLevel(''); }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary-orange hover:underline"
                >
                  Reset filter <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-6' : 'space-y-3 pt-6'}>
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} view={view} onDetail={goDetail} onApply={goApply} />
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
