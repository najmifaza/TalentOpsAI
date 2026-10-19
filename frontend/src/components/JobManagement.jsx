import React, { useState, useEffect, useCallback } from 'react';
import { 
  Briefcase, 
  Plus, 
  CheckCircle2, 
  Sliders, 
  Edit3, 
  Trash2, 
  X, 
  Layers, 
  Code2, 
  GraduationCap, 
  Calendar, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle,
  Building2,
  Sparkles,
  Check
} from 'lucide-react';

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

const FALLBACK_JOBS = [
  {
    id: 1,
    title: 'Senior Backend Engineer',
    department: 'Core Engineering',
    raw_text: 'Bertanggung jawab membangun arsitektur microservices berkinerja tinggi, asynchronous event streaming, integrasi basis data relasional ACID, dan kepatuhan privasi data UU PDP.',
    core_competencies: ['FastAPI', 'Docker', 'MariaDB', 'PostgreSQL', 'CI/CD', 'Redis'],
    weight_config: { SKILL: 0.4, EXPERIENCE: 0.3, EDUCATION: 0.1, PORTFOLIO: 0.2 },
    status: 'active'
  },
  {
    id: 2,
    title: 'AI Data & Evaluation Engineer',
    department: 'AI Intelligence Group',
    raw_text: 'Mengembangkan sistem evaluasi otonom berbasis LLM, skema ekstraksi terstruktur Pydantic v2, anti-hallucination guard, dan algoritma scoring deterministik multi-dimensi.',
    core_competencies: ['Python', 'Gemini 3.8', 'Pydantic v2', 'Pytest', 'NumPy', 'Data Pipeline'],
    weight_config: { SKILL: 0.45, EXPERIENCE: 0.2, EDUCATION: 0.15, PORTFOLIO: 0.2 },
    status: 'active'
  },
  {
    id: 3,
    title: 'Lead Frontend UI/UX Engineer',
    department: 'Product Experience',
    raw_text: 'Membangun antarmuka web SPA kelas enterprise dengan React 18, Vite, Tailwind CSS, visualisasi graf interaktif React Flow, dan listener Server-Sent Events.',
    core_competencies: ['React 18', 'Vite', 'Tailwind CSS', 'React Flow', 'TypeScript', 'SSE Streaming'],
    weight_config: { SKILL: 0.4, EXPERIENCE: 0.25, EDUCATION: 0.1, PORTFOLIO: 0.25 },
    status: 'active'
  }
];

export default function JobManagement() {
  const [jobs, setJobs] = useState(FALLBACK_JOBS);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formComp, setFormComp] = useState('');
  const [formWeights, setFormWeights] = useState({ SKILL: 40, EXPERIENCE: 30, EDUCATION: 10, PORTFOLIO: 20 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/jobs`);
      } catch (e) {
        res = await fetch('/api/jobs');
      }
      if (res && res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setJobs(json.data);
        }
      }
    } catch (err) {
      console.warn('Using fallback jobs list:', err);
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
    setFormWeights({ SKILL: 40, EXPERIENCE: 30, EDUCATION: 10, PORTFOLIO: 20 });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    setFormTitle(job.title);
    setFormDept(job.department || 'General');
    setFormDesc(job.raw_text || '');
    setFormComp((job.core_competencies || []).join(', '));
    const w = job.weight_config || {};
    setFormWeights({
      SKILL: Math.round((w.SKILL || 0.4) * 100),
      EXPERIENCE: Math.round((w.EXPERIENCE || 0.3) * 100),
      EDUCATION: Math.round((w.EDUCATION || 0.1) * 100),
      PORTFOLIO: Math.round((w.PORTFOLIO || 0.2) * 100),
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

    // Normalisasi bobot agar total = 1.0
    const rawTotal = formWeights.SKILL + formWeights.EXPERIENCE + formWeights.EDUCATION + formWeights.PORTFOLIO;
    if (rawTotal <= 0) {
      setErrorMsg('Total bobot harus lebih dari 0%.');
      return;
    }

    const normalizedWeights = {
      SKILL: Math.round((formWeights.SKILL / rawTotal) * 100) / 100,
      EXPERIENCE: Math.round((formWeights.EXPERIENCE / rawTotal) * 100) / 100,
      EDUCATION: Math.round((formWeights.EDUCATION / rawTotal) * 100) / 100,
      PORTFOLIO: Math.round((formWeights.PORTFOLIO / rawTotal) * 100) / 100,
    };

    // Pastikan rounding sum persis 1.0
    const sumNorm = normalizedWeights.SKILL + normalizedWeights.EXPERIENCE + normalizedWeights.EDUCATION + normalizedWeights.PORTFOLIO;
    const diff = Math.round((1.0 - sumNorm) * 100) / 100;
    normalizedWeights.SKILL = Math.round((normalizedWeights.SKILL + diff) * 100) / 100;

    setIsSubmitting(true);

    try {
      const payload = {
        title: formTitle.trim(),
        department: formDept.trim(),
        raw_text: formDesc.trim(),
        core_competencies: competenciesArray,
        weight_config: normalizedWeights,
      };

      let res;
      if (editingJob) {
        try {
          res = await fetch(`${API_BASE_URL}/api/jobs/${editingJob.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          res = await fetch(`/api/jobs/${editingJob.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      } else {
        try {
          res = await fetch(`${API_BASE_URL}/api/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      }

      if (res && res.ok) {
        setFeedbackMsg(editingJob ? 'Lowongan & bobot berhasil diperbarui.' : 'Lowongan baru & konfigurasi bobot 4D berhasil disimpan.');
        setIsModalOpen(false);
        fetchJobs();
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else {
        // Fallback local update if network error
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
      await fetch(`${API_BASE_URL}/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (e) {}
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: nextStatus } : j));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Actions */}
      <div className="clean-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#eaf0ff] text-[11px] font-bold text-[#1b55f5] mb-2 border border-[#8ec0ff]">
            <Sliders className="w-3.5 h-3.5 text-[#1b55f5]" />
            <span>Job Intelligence &amp; 4D Weights</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#000000] tracking-tight font-display">
            Kelola Lowongan &amp; Konfigurasi Bobot 4D
          </h2>
          <p className="text-xs text-[#67677e] mt-1 max-w-2xl leading-relaxed">
            Tiap lowongan kerja memiliki daftar kualifikasi kompetensi inti serta formula pembobotan deterministik 
            (Keahlian, Pengalaman, Pendidikan, Portofolio) yang tersimpan permanen di basis data.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] text-white text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Lowongan Baru</span>
          </button>

          <button
            onClick={fetchJobs}
            disabled={loading}
            className="p-2.5 rounded-lg bg-white border border-[#d8d8df] text-[#67677e] hover:text-[#000000] hover:bg-[#f4f4f6] transition-all shadow-2xs"
            title="Muat ulang daftar lowongan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1b55f5]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-[11px] underline">Tutup</button>
        </div>
      )}

      {/* 2. Job Opening Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {jobs.map((job) => {
          const w = job.weight_config || { SKILL: 0.4, EXPERIENCE: 0.3, EDUCATION: 0.1, PORTFOLIO: 0.2 };
          const pSkill = Math.round((w.SKILL || 0) * 100);
          const pExp = Math.round((w.EXPERIENCE || 0) * 100);
          const pEdu = Math.round((w.EDUCATION || 0) * 100);
          const pPort = Math.round((w.PORTFOLIO || 0) * 100);
          const isActive = job.status === 'active';

          return (
            <div 
              key={job.id} 
              className={`clean-card p-5 flex flex-col justify-between border-t-4 transition-all shadow-xs ${
                isActive ? 'border-t-[#1b55f5]' : 'border-t-slate-400 opacity-75'
              }`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#e6e6ea]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-[#000000] font-display">
                        {job.title}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isActive ? 'Aktif' : 'Ditutup'}
                      </span>
                    </div>
                    <p className="text-xs text-[#67677e] mt-0.5 flex items-center gap-1.5 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-[#1b55f5]" />
                      <span>{job.department || 'Engineering'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(job)}
                      className="p-1.5 rounded-lg bg-[#f4f4f6] hover:bg-[#eaf0ff] hover:text-[#1b55f5] text-[#67677e] border border-[#d8d8df] transition-colors"
                      title="Edit Lowongan & Ubah Bobot 4D"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(job)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                        isActive 
                          ? 'border-rose-200 text-rose-700 hover:bg-rose-50' 
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {isActive ? 'Tutup' : 'Aktifkan'}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#454554] mt-3 line-clamp-2 leading-relaxed">
                  {job.raw_text}
                </p>

                {/* Core Competencies Chips */}
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-bold text-[#67677e] tracking-wider block mb-1.5">
                    Kompetensi Kunci Wajib ({job.core_competencies?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {job.core_competencies && job.core_competencies.map((comp, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-[#f4f4f6] text-[#000000] border border-[#e6e6ea] font-mono font-medium">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4D Weight Allocation Bar */}
              <div className="mt-4 pt-3 border-t border-[#e6e6ea]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-[#000000] flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-[#1b55f5]" />
                    <span>Formula Bobot 4 Dimensi</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#1b55f5]">Total 100%</span>
                </div>

                {/* Segmented Color Bar */}
                <div className="h-2 w-full rounded-full bg-[#f4f4f6] overflow-hidden flex">
                  <div style={{ width: `${pSkill}%` }} className="bg-[#1b55f5]" title={`Skill: ${pSkill}%`}></div>
                  <div style={{ width: `${pExp}%` }} className="bg-amber-500" title={`Experience: ${pExp}%`}></div>
                  <div style={{ width: `${pEdu}%` }} className="bg-purple-500" title={`Education: ${pEdu}%`}></div>
                  <div style={{ width: `${pPort}%` }} className="bg-emerald-500" title={`Portfolio: ${pPort}%`}></div>
                </div>

                {/* Legend Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#454554]">
                    <span className="w-2 h-2 rounded-full bg-[#1b55f5] shrink-0"></span>
                    <span>Skill: <strong>{pSkill}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#454554]">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    <span>Exp: <strong>{pExp}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#454554]">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                    <span>Edu: <strong>{pEdu}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#454554]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Port: <strong>{pPort}%</strong></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Modal Form: Buat / Edit Lowongan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#e6e6ea] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#e6e6ea] flex items-center justify-between bg-[#f4f4f6]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1b55f5] text-white flex items-center justify-center shadow-xs">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#000000] font-display">
                    {editingJob ? 'Edit Lowongan & Bobot 4D' : 'Buat Lowongan Pekerjaan Baru'}
                  </h3>
                  <p className="text-xs text-[#67677e]">
                    Pengaturan tersimpan permanen per lowongan pada basis data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#67677e] hover:text-[#000000] hover:bg-[#e6e6ea] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Title & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#000000]">
                    Judul Posisi Lowongan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Senior Backend Engineer"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] placeholder-[#67677e] font-medium focus:outline-none focus:border-[#1b55f5]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#000000]">
                    Departemen / Divisi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Core Engineering"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] placeholder-[#67677e] font-medium focus:outline-none focus:border-[#1b55f5]"
                  />
                </div>
              </div>

              {/* Job Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#000000]">
                  Deskripsi Tanggung Jawab &amp; Persyaratan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Tuliskan gambaran umum posisi dan ekspektasi peran teknis..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] placeholder-[#67677e] font-medium focus:outline-none focus:border-[#1b55f5]"
                />
              </div>

              {/* Core Competencies */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#000000]">
                  Keahlian &amp; Taksonomi Kunci (Pisahkan dengan koma) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="FastAPI, Docker, PostgreSQL, Redis, CI/CD"
                  value={formComp}
                  onChange={(e) => setFormComp(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] placeholder-[#67677e] font-medium focus:outline-none focus:border-[#1b55f5]"
                />
                <p className="text-[11px] text-[#67677e]">
                  Keahlian ini digunakan oleh <em>Coverage Scoring Engine</em> untuk mencocokkan klaim kandidat secara deterministik.
                </p>
              </div>

              {/* 4D Weight Config Section */}
              <div className="pt-3 border-t border-[#e6e6ea] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                      Formula Bobot 4 Dimensi Penilaian
                    </h4>
                    <p className="text-[11px] text-[#67677e]">
                      Tentukan porsi evaluasi untuk lowongan ini (Total otomatis dinormalisasikan 100%)
                    </p>
                  </div>

                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#eaf0ff] text-[#1b55f5]">
                    Total: {formWeights.SKILL + formWeights.EXPERIENCE + formWeights.EDUCATION + formWeights.PORTFOLIO}%
                  </span>
                </div>

                {/* Preset Fast Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleApplyPreset(key)}
                      className="p-2 rounded-lg bg-[#f4f4f6] hover:bg-[#eaf0ff] hover:text-[#1b55f5] text-left border border-[#e6e6ea] transition-all"
                    >
                      <div className="text-[11px] font-bold text-[#000000]">{p.label}</div>
                      <div className="text-[9px] text-[#67677e] mt-0.5 font-mono">
                        {p.weights.SKILL}%/{p.weights.EXPERIENCE}%/{p.weights.EDUCATION}%/{p.weights.PORTFOLIO}%
                      </div>
                    </button>
                  ))}
                </div>

                {/* Sliders */}
                <div className="space-y-3 bg-[#f8f9fc] p-3.5 rounded-xl border border-[#e6e6ea]">
                  {/* Skill */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#000000] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#1b55f5]"></span>
                        Kesesuaian Keahlian Inti (SKILL)
                      </span>
                      <span className="font-mono font-bold text-[#1b55f5]">{formWeights.SKILL}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={formWeights.SKILL}
                      onChange={(e) => setFormWeights(prev => ({ ...prev, SKILL: Number(e.target.value) }))}
                      className="w-full accent-[#1b55f5]"
                    />
                  </div>

                  {/* Experience */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#000000] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Kronologi Pengalaman Kerja (EXPERIENCE)
                      </span>
                      <span className="font-mono font-bold text-amber-700">{formWeights.EXPERIENCE}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={formWeights.EXPERIENCE}
                      onChange={(e) => setFormWeights(prev => ({ ...prev, EXPERIENCE: Number(e.target.value) }))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Education */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#000000] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Linieritas Jenjang Pendidikan (EDUCATION)
                      </span>
                      <span className="font-mono font-bold text-purple-700">{formWeights.EDUCATION}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={formWeights.EDUCATION}
                      onChange={(e) => setFormWeights(prev => ({ ...prev, EDUCATION: Number(e.target.value) }))}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  {/* Portfolio */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#000000] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Portofolio &amp; Repositori GitHub (PORTFOLIO)
                      </span>
                      <span className="font-mono font-bold text-emerald-700">{formWeights.PORTFOLIO}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={formWeights.PORTFOLIO}
                      onChange={(e) => setFormWeights(prev => ({ ...prev, PORTFOLIO: Number(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-[#e6e6ea] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-[#f4f4f6] hover:bg-[#e6e6ea] text-[#000000] text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Menyimpan Lowongan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
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
