import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Plus,
  CheckCircle2,
  Sliders,
  Edit3,
  X,
  RefreshCw,
  AlertCircle,
  Building2,
  Check
} from 'lucide-react';
import WeightBar from './WeightBar';
import WeightSliders from './WeightSliders';
import { toPercent, toRatio, DEFAULT_WEIGHT_PCT } from '../lib/dimensions';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

const PRESETS = {
  balanced: {
    label: 'Standar Berimbang',
    desc: 'Proporsi seimbang antara keahlian teknis dan pengalaman kerja.',
    weights: { SKILL: 40, EXPERIENCE: 30, EDUCATION: 10, PORTFOLIO: 20 },
  },
  code_first: {
    label: 'Praktik Kode & Portofolio',
    desc: 'Menitikberatkan validasi repositori GitHub dan arsitektur kode.',
    weights: { SKILL: 45, EXPERIENCE: 20, EDUCATION: 10, PORTFOLIO: 25 },
  },
  security_strict: {
    label: 'Kepatuhan & Integritas Tinggi',
    desc: 'Penekanan tinggi pada verifikasi audit dan integritas rekam jejak.',
    weights: { SKILL: 30, EXPERIENCE: 30, EDUCATION: 10, PORTFOLIO: 30 },
  },
  junior_friendly: {
    label: 'Talenta Muda / Fresh Graduate',
    desc: 'Fokus pada kompetensi teknis dasar dan pendidikan formal.',
    weights: { SKILL: 50, EXPERIENCE: 15, EDUCATION: 20, PORTFOLIO: 15 },
  },
};

// Profil publik (migrasi 005). Kolom yang dipakai halaman /lowongan/:id dan
// kartu di /lowongan. Kosong berarti portal menyembunyikan barisnya.
const EMPTY_PROFILE = {
  company_name: '',
  company_logo_url: '',
  company_about: '',
  company_address: '',
  company_industry: '',
  company_website: '',
  job_function: '',
  employment_level: '',
  location: '',
  deadline: '',
  description_text: '',
  requirements_text: '',
};

// Input teks pendek: satu baris konfigurasi, bukan satu blok JSX per field.
const PROFILE_TEXT_FIELDS = [
  { key: 'company_name', label: 'Nama Perusahaan', placeholder: 'PT Global Service Indonesia', half: true },
  { key: 'company_logo_url', label: 'URL Logo Perusahaan', placeholder: 'https://.../logo.png', half: true },
  { key: 'job_function', label: 'Fungsi Pekerjaan', placeholder: 'Engineering / Supply Chain', half: true },
  { key: 'employment_level', label: 'Jenjang', placeholder: 'Lulusan Baru / Profesional', half: true },
  { key: 'location', label: 'Lokasi Kerja', placeholder: 'Jakarta Selatan (Hibrida)', half: true },
  { key: 'deadline', label: 'Batas Lamar', type: 'date', half: true },
  { key: 'company_industry', label: 'Industri', placeholder: 'Teknologi Informasi', half: true },
  { key: 'company_website', label: 'Website Perusahaan', placeholder: 'https://perusahaan.co.id', half: true },
  { key: 'company_address', label: 'Alamat Kantor', placeholder: 'Jl. ... Kota, Provinsi', half: false },
];

export default function JobManagement() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formComp, setFormComp] = useState('');
  const [formWeights, setFormWeights] = useState(DEFAULT_WEIGHT_PCT);
  // Profil publik (migrasi 005) disimpan sebagai satu objek: 12 useState terpisah
  // hanya menambah baris tanpa menambah kejelasan.
  const [formProfile, setFormProfile] = useState(EMPTY_PROFILE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs`);
      if (res && res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setJobs(json.data);
        } else {
          setJobs([]);
        }
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.warn('Failed to fetch jobs list:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const openCreateModal = () => {
    setEditingJob(null);
    setFormTitle('');
    setFormDept('Core Engineering');
    setFormDesc('');
    setFormComp('');
    setFormWeights(DEFAULT_WEIGHT_PCT);
    setFormProfile(EMPTY_PROFILE);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    setFormTitle(job.title);
    setFormDept(job.department || 'General');
    setFormDesc(job.raw_text || '');
    setFormComp((job.core_competencies || []).join(', '));
    setFormWeights(toPercent(job.weight_config));
    // Deadline dari API berupa ISO penuh; <input type="date"> hanya menerima YYYY-MM-DD.
    setFormProfile({
      ...EMPTY_PROFILE,
      ...Object.fromEntries(
        Object.keys(EMPTY_PROFILE).map((key) => [key, job[key] ?? ''])
      ),
      deadline: job.deadline ? String(job.deadline).slice(0, 10) : '',
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleApplyPreset = (presetKey) => {
    const p = PRESETS[presetKey];
    if (p) {
      setFormWeights(p.weights);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formTitle.trim()) {
      setErrorMsg('Judul lowongan wajib diisi.');
      return;
    }
    if (!formDesc.trim() || formDesc.trim().length < 10) {
      setErrorMsg('Deskripsi lowongan wajib diisi minimal 10 karakter.');
      return;
    }

    const competenciesArray = formComp
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (competenciesArray.length === 0) {
      setErrorMsg('Masukkan minimal 1 keahlian/kompetensi inti (pisahkan dengan koma).');
      return;
    }

    // Sliders already hold 100% (redistribute guarantees it); toRatio only scales
    // and fixes float drift, so what the user sees is what gets stored.
    const normalizedWeights = toRatio(formWeights);

    setIsSubmitting(true);

    try {
      const payload = {
        title: formTitle.trim(),
        department: formDept.trim(),
        raw_text: formDesc.trim(),
        core_competencies: competenciesArray,
        weight_config: normalizedWeights,
        // String kosong dikirim sebagai null supaya portal menyembunyikan barisnya,
        // bukan mencetak label dengan nilai kosong.
        ...Object.fromEntries(
          Object.entries(formProfile).map(([key, value]) => [
            key,
            typeof value === 'string' && value.trim() === '' ? null : value.trim(),
          ])
        ),
      };

      let res;
      if (editingJob) {
        res = await fetch(`${API_BASE_URL}/api/jobs/${editingJob.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/api/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res && res.ok) {
        setFeedbackMsg(editingJob ? 'Lowongan & bobot berhasil diperbarui.' : 'Lowongan baru & konfigurasi bobot 4D berhasil disimpan.');
        setIsModalOpen(false);
        fetchJobs();
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else {
        const localJob = {
          id: editingJob ? editingJob.id : Date.now(),
          ...payload,
          status: 'active'
        };
        setJobs(prev => editingJob ? prev.map(j => j.id === editingJob.id ? localJob : j) : [localJob, ...prev]);
        setFeedbackMsg('Konfigurasi lowongan disimpan (Mode Sinkronisasi Lokal).');
        setIsModalOpen(false);
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan lowongan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (job) => {
    const nextStatus = job.status === 'active' ? 'closed' : 'active';
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        // Don't flip the badge on a rejected write — that made the card disagree
        // with the database until the next reload.
        setFeedbackMsg(`Status lowongan gagal diubah (server ${res.status}). Muat ulang lalu coba lagi.`);
        setTimeout(() => setFeedbackMsg(null), 5000);
        return;
      }
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: nextStatus } : j));
      setFeedbackMsg(nextStatus === 'active' ? 'Lowongan diaktifkan.' : 'Lowongan ditutup.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      setFeedbackMsg('Gagal menghubungi server. Status lowongan tidak berubah.');
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-jkt">
      {/* 1. Header & Actions */}
      <div className="bg-white rounded-2xl border border-primary-border-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.03] bg-dot-matrix pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-orange/10 text-primary-black text-xs font-semibold mb-2 border border-primary-orange/30">
            <Sliders className="w-3.5 h-3.5 text-primary-orange" />
            <span className="font-bold tracking-wider uppercase text-[11px]">Job Intelligence &amp; 4D Weights</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-primary-black tracking-tight leading-tight">
            Kelola Lowongan &amp; Konfigurasi Bobot 4D
          </h2>
          <p className="text-xs text-primary-slate-600 mt-1 leading-relaxed">
            Tiap lowongan kerja memiliki daftar kualifikasi kompetensi inti serta formula pembobotan deterministik 
            (Keahlian, Pengalaman, Pendidikan, Portofolio) yang tersimpan permanen di basis data.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative z-10">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary-orange hover:opacity-90 text-white text-xs font-bold transition-all shadow-lg shadow-primary-orange/25"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Buat Lowongan Baru</span>
          </button>

          <button
            onClick={fetchJobs}
            disabled={loading}
            className="p-2.5 rounded-full bg-white border border-primary-border-200 text-primary-slate-700 hover:text-primary-orange hover:border-primary-orange transition-all shadow-xs"
            title="Muat ulang daftar lowongan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-orange' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in ${/gagal|tidak berubah/i.test(feedbackMsg) ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-[11px] underline">Tutup</button>
        </div>
      )}

      {/* 2. Job Opening Cards Grid */}
      {jobs.length === 0 && !loading ? (
        <div className="bg-white rounded-2xl border border-primary-border-200 p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-slate-100 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-primary-slate-400" />
          </div>
          <p className="text-sm font-bold text-primary-black">Belum Ada Lowongan</p>
          <p className="text-xs text-primary-slate-500 max-w-xs">
            Klik "Buat Lowongan Baru" untuk menambahkan posisi dan konfigurasi bobot evaluasi 4D.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {jobs.map((job) => {
          const weightPct = toPercent(job.weight_config);
          const isActive = job.status === 'active';

          return (
            <div 
              key={job.id} 
              className={`rounded-2xl border border-primary-border-200 bg-white p-6 flex flex-col justify-between border-t-4 transition-all shadow-sm hover:border-primary-orange hover:shadow-card-hover ${
                isActive ? 'border-t-primary-orange' : 'border-t-primary-slate-300 opacity-75'
              }`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-primary-border-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base sm:text-lg text-primary-black">
                        {job.title}
                      </h3>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-primary-slate-100 text-primary-slate-700 border border-primary-border-200'
                      }`}>
                        {isActive ? 'Aktif' : 'Ditutup'}
                      </span>
                    </div>
                    <p className="text-xs text-primary-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-primary-blue" />
                      <span>{job.department || 'Engineering'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(job)}
                      className="p-1.5 rounded-full bg-primary-slate-50 hover:bg-primary-orange/10 hover:text-primary-orange text-primary-slate-600 border border-primary-border-200 transition-colors"
                      title="Edit Lowongan & Ubah Bobot 4D"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(job)}
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-colors ${
                        isActive 
                          ? 'border-rose-200 text-rose-700 hover:bg-rose-50' 
                          : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      {isActive ? 'Tutup' : 'Aktifkan'}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-primary-slate-600 mt-3 line-clamp-2 leading-relaxed">
                  {job.raw_text}
                </p>

                {/* Core Competencies Chips */}
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-bold text-primary-slate-500 tracking-wider block mb-1.5">
                    Kompetensi Kunci Wajib ({job.core_competencies?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {job.core_competencies && job.core_competencies.map((comp, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-primary-slate-50 text-primary-black border border-primary-border-200 font-mono font-medium">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4D Weight Allocation Bar */}
              <div className="mt-4 pt-3 border-t border-primary-border-100">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-primary-black flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-primary-orange" />
                    <span>Formula Bobot 4 Dimensi</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-primary-orange">Total 100%</span>
                </div>

                <WeightBar weights={weightPct} />
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* 3. Modal Form: Buat / Edit Lowongan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-primary-border-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-primary-border-100 flex items-center justify-between bg-primary-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-orange text-white flex items-center justify-center shadow-xs">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-primary-black">
                    {editingJob ? 'Edit Lowongan & Bobot 4D' : 'Buat Lowongan Pekerjaan Baru'}
                  </h3>
                  <p className="text-xs text-primary-slate-500">
                    Pengaturan tersimpan permanen per lowongan pada basis data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-primary-slate-400 hover:text-primary-black hover:bg-primary-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Title & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary-black">
                    Judul Posisi Lowongan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Senior Backend Engineer"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary-black">
                    Departemen / Divisi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Core Engineering"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                  />
                </div>
              </div>

              {/* Job Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-primary-black">
                  Deskripsi Tanggung Jawab &amp; Persyaratan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Tuliskan gambaran umum posisi dan ekspektasi peran teknis..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                />
              </div>

              {/* Core Competencies */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-primary-black">
                  Keahlian &amp; Taksonomi Kunci (Pisahkan dengan koma) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="FastAPI, Docker, PostgreSQL, Redis, CI/CD"
                  value={formComp}
                  onChange={(e) => setFormComp(e.target.value)}
                  className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                />
                <p className="text-[11px] text-primary-slate-500">
                  Keahlian ini digunakan oleh <em>Coverage Scoring Engine</em> untuk mencocokkan klaim kandidat secara deterministik.
                </p>
              </div>

              {/* Profil Publik: dipakai kartu /lowongan dan sidebar /lowongan/:id.
                  Semua opsional — kosong berarti portal menyembunyikan barisnya. */}
              <div className="pt-3 border-t border-primary-border-100 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary-black">
                    Profil Publik Lowongan
                  </h4>
                  <p className="text-[11px] text-primary-slate-500">
                    Tampil di portal karier publik. Kolom yang dikosongkan tidak ditampilkan, bukan tampil kosong.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PROFILE_TEXT_FIELDS.map(({ key, label, placeholder, half, type }) => (
                    <div key={key} className={`space-y-1.5 ${half ? '' : 'sm:col-span-2'}`}>
                      <label className="text-xs font-bold text-primary-black">{label}</label>
                      <input
                        type={type || 'text'}
                        placeholder={placeholder}
                        value={formProfile[key] || ''}
                        onChange={(e) => setFormProfile((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary-black">Tentang Perusahaan</label>
                  <textarea
                    rows={3}
                    placeholder="Profil singkat perusahaan yang tampil di sidebar halaman detail..."
                    value={formProfile.company_about || ''}
                    onChange={(e) => setFormProfile((prev) => ({ ...prev, company_about: e.target.value }))}
                    className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-primary-black">Deskripsi Pekerjaan</label>
                    <textarea
                      rows={5}
                      placeholder={'Satu butir per baris.\nMerancang layanan backend...\nMengelola basis data...'}
                      value={formProfile.description_text || ''}
                      onChange={(e) => setFormProfile((prev) => ({ ...prev, description_text: e.target.value }))}
                      className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                    />
                    <p className="text-[11px] text-primary-slate-500">
                      Portal menomori otomatis. Tulis satu butir per baris tanpa angka.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-primary-black">Persyaratan</label>
                    <textarea
                      rows={5}
                      placeholder={'Satu butir per baris.\nS1 Informatika.\nPengalaman 3 tahun...'}
                      value={formProfile.requirements_text || ''}
                      onChange={(e) => setFormProfile((prev) => ({ ...prev, requirements_text: e.target.value }))}
                      className="w-full px-3 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white"
                    />
                    <p className="text-[11px] text-primary-slate-500">
                      Satu butir per baris. Ini yang dibaca pelamar, terpisah dari teks yang dinilai mesin.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4D Weight Config Section */}
              <div className="pt-3 border-t border-primary-border-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary-black">
                      Formula Bobot 4 Dimensi Penilaian
                    </h4>
                    <p className="text-[11px] text-primary-slate-500">
                      Tentukan porsi evaluasi untuk lowongan ini. Menggeser satu dimensi menyesuaikan tiga lainnya agar total tetap 100%.
                    </p>
                  </div>

                </div>

                {/* Preset Fast Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleApplyPreset(key)}
                      className="p-2.5 rounded-xl bg-primary-slate-50 hover:bg-white hover:border-primary-orange text-left border border-primary-border-200 transition-all shadow-xs"
                    >
                      <div className="text-[11px] font-bold text-primary-black">{p.label}</div>
                      <div className="text-[9px] text-primary-slate-500 mt-0.5 font-mono">
                        {p.weights.SKILL}%/{p.weights.EXPERIENCE}%/{p.weights.EDUCATION}%/{p.weights.PORTFOLIO}%
                      </div>
                    </button>
                  ))}
                </div>

                <WeightSliders weights={formWeights} onChange={setFormWeights} />
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-primary-border-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-full bg-primary-slate-100 hover:bg-primary-slate-200 text-primary-black text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-full bg-primary-orange hover:opacity-90 text-white text-xs font-bold transition-all shadow-lg shadow-primary-orange/25 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Menyimpan Lowongan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>{editingJob ? 'Simpan Perubahan' : 'Buat Lowongan & Simpan Bobot'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
