import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  MapPin, Briefcase, Clock, ChevronRight, RefreshCw, AlertCircle,
  Share2, Building2, Globe, ArrowLeft, ShieldCheck, Gauge, CheckCircle2
} from 'lucide-react';
import PublicLayout from './PublicLayout';
import { API_BASE_URL } from '../../lib/api';
import { formatDate } from '../../lib/format';

// Satu butir per baris di DB (lihat migrations/005 + seed_data.py). Nomor
// ditambahkan saat render supaya rekruter cukup mengetik daftar biasa.
function NumberedList({ text, emptyLabel }) {
  const items = String(text || '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '').trim())
    .filter(Boolean);

  if (items.length === 0) {
    return <p className="text-xs text-primary-slate-400 italic">{emptyLabel}</p>;
  }

  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-xs text-primary-slate-700 leading-relaxed">
          <span className="shrink-0 font-bold text-primary-black tabular-nums">{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function BiasAuditBadge({ audit }) {
  if (!audit) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-slate-100 border border-primary-border-200 text-[11px] font-semibold text-primary-slate-600">
        <ShieldCheck className="w-3.5 h-3.5 text-primary-slate-400" />
        Belum diaudit bias
      </span>
    );
  }
  const clean = audit.total_flags === 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
        clean
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
          : 'bg-amber-50 text-amber-900 border-amber-300'
      }`}
      title="Hasil audit bahasa lowongan: istilah gender-eksklusif, batas usia, bias almamater, dan ekspektasi kerja ambigu."
    >
      {clean ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Gauge className="w-3.5 h-3.5" />}
      Inklusivitas {audit.inclusivity_score}/100
      {!clean && ` · ${audit.total_flags} temuan`}
    </span>
  );
}

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/careers/${id}`);
        if (res.status === 404) {
          if (!cancelled) setError('Lowongan tidak ditemukan atau sudah ditutup.');
          return;
        }
        if (!res.ok) throw new Error(`Server merespons ${res.status}`);
        const json = await res.json();
        if (!cancelled) setJob(json);
      } catch (err) {
        if (!cancelled) setError('Detail lowongan gagal dimuat. Periksa koneksi lalu coba lagi.');
        console.warn('Job detail fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const share = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: job?.title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-20 flex flex-col items-center gap-2 text-xs text-primary-slate-600">
          <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
          Memuat detail lowongan...
        </div>
      </PublicLayout>
    );
  }

  if (error || !job) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="font-bold text-base text-primary-black">{error || 'Lowongan tidak ditemukan.'}</p>
          <button
            onClick={() => navigate('/lowongan')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-orange text-white text-xs font-bold hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke daftar lowongan
          </button>
        </div>
      </PublicLayout>
    );
  }

  const deadlinePassed = job.deadline && new Date(job.deadline) < new Date();

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-6">
        <nav className="flex items-center gap-1.5 text-[11px] text-primary-slate-500" aria-label="Breadcrumb">
          <Link to="/lowongan" className="hover:text-primary-orange font-semibold">Lowongan</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-primary-slate-700">Detail pekerjaan</span>
        </nav>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Kolom utama */}
          <div className="lg:col-span-8 bg-white border border-primary-border-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              {job.company_logo_url ? (
                <img
                  src={job.company_logo_url}
                  alt={job.company_name || 'Perusahaan'}
                  className="w-16 h-16 rounded-xl object-contain border border-primary-border-200 bg-white shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-primary-black text-white font-extrabold text-lg flex items-center justify-center shrink-0">
                  {(job.company_name || 'PR').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-extrabold text-xl sm:text-2xl text-primary-black leading-tight tracking-tight">
                  {job.title}
                </h1>
                <p className="text-sm font-semibold text-primary-blue mt-1">{job.company_name || 'Perusahaan'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-primary-slate-600">
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
              {job.deadline && (
                <span className={`inline-flex items-center gap-1.5 font-semibold ${deadlinePassed ? 'text-rose-600' : ''}`}>
                  <Clock className="w-3.5 h-3.5" />
                  {deadlinePassed ? 'Batas lamar terlewat' : `Batas Lamar: ${formatDate(job.deadline)}`}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                onClick={() => navigate(`/lowongan/${job.id}/lamar`)}
                disabled={deadlinePassed}
                title={deadlinePassed ? 'Lowongan sudah melewati batas lamar' : undefined}
                className="flex-1 sm:flex-none px-8 py-3 rounded-full bg-primary-orange text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-orange/25 transition-all"
              >
                {deadlinePassed ? 'Batas Lamar Terlewat' : 'Lamar'}
              </button>
              <button
                onClick={share}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-full border border-primary-border-200 text-xs font-bold text-primary-black hover:border-primary-orange transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 text-primary-slate-500" /> Bagikan
              </button>
              <div className="sm:ml-auto self-start sm:self-center">
                <BiasAuditBadge audit={job.bias_audit} />
              </div>
            </div>

            <section className="pt-2 border-t border-primary-border-100">
              <h2 className="font-extrabold text-sm text-primary-black mb-3">Deskripsi Pekerjaan</h2>
              <NumberedList
                text={job.description_text}
                emptyLabel="Deskripsi pekerjaan belum diisi rekruter."
              />
            </section>

            <section className="pt-4 border-t border-primary-border-100">
              <h2 className="font-extrabold text-sm text-primary-black mb-3">Persyaratan</h2>
              <NumberedList
                text={job.requirements_text}
                emptyLabel="Persyaratan belum diisi rekruter."
              />
            </section>

            {job.core_competencies?.length > 0 && (
              <section className="pt-4 border-t border-primary-border-100">
                <h2 className="font-extrabold text-sm text-primary-black mb-3">Kompetensi Inti yang Dinilai</h2>
                <div className="flex flex-wrap gap-1.5">
                  {job.core_competencies.map((tech, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-semibold text-primary-black bg-primary-slate-50 border border-primary-border-200 rounded-md px-2 py-1 font-mono"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-primary-slate-500 mt-2.5 leading-relaxed">
                  Daftar ini dipakai mesin penilaian untuk mencocokkan bukti pada CV Anda. Tidak ada penilaian
                  berdasarkan nama, usia, gender, atau almamater.
                </p>
              </section>
            )}
          </div>

          {/* Sidebar perusahaan */}
          <aside className="lg:col-span-4 lg:sticky lg:top-28">
            <div className="bg-white border border-primary-border-200 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="font-extrabold text-sm text-primary-black">Tentang Perusahaan</h2>
                <p className="text-xs font-semibold text-primary-blue mt-1">{job.company_name || 'Perusahaan'}</p>
              </div>

              {job.company_about ? (
                <p className="text-[11px] text-primary-slate-600 leading-relaxed">{job.company_about}</p>
              ) : (
                <p className="text-[11px] text-primary-slate-400 italic">Profil perusahaan belum diisi.</p>
              )}

              <div className="space-y-3.5 pt-1">
                {job.company_address && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-500 mb-1">Alamat Kantor</h3>
                    <p className="text-[11px] text-primary-slate-700 leading-relaxed flex gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary-slate-400 shrink-0 mt-0.5" />
                      {job.company_address}
                    </p>
                  </div>
                )}
                {job.company_industry && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-500 mb-1">Industri</h3>
                    <p className="text-[11px] text-primary-slate-700 flex gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary-slate-400 shrink-0" />
                      {job.company_industry}
                    </p>
                  </div>
                )}
                {job.company_website && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-500 mb-1">Website</h3>
                    <a
                      href={job.company_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary-blue hover:underline flex gap-1.5 break-all"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {job.company_website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}
