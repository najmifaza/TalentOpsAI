import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  UploadCloud,
  FileText,
  AlertCircle,
  ShieldCheck,
  Lock,
  ArrowRight,
  Building2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Search,
  EyeOff,
  Cpu,
  Compass
} from 'lucide-react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import PublicLayout from './careers/PublicLayout';
import DpaModal from './DpaModal';
import TokenIssuedModal from './TokenIssuedModal';
import ApplicationTracker from './ApplicationTracker';

export default function CareerPortal({ onBackToDashboard, initialTab = 'apply' }) {
  const navigate = useNavigate();
  const { token: urlToken } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // /apply?job=12 datang dari tombol "Lamar" di papan lowongan. Tanpa ini
  // pelamar mendarat di formulir kosong dan harus mencari posisinya lagi.
  const requestedJobId = searchParams.get('job');

  const isTrackRoute = location.pathname.includes('/track') || initialTab === 'track';
  const [activeTab, setActiveTab] = useState(isTrackRoute ? 'track' : 'apply');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Sync tab with URL route changes and params
  useEffect(() => {
    if (location.pathname.includes('/track')) {
      setActiveTab('track');
      if (urlToken) {
        setTrackerInitialToken(urlToken);
      }
    } else {
      setActiveTab('apply');
    }
  }, [location.pathname, urlToken]);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [dpaConsent, setDpaConsent] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [issuedResult, setIssuedResult] = useState(null);
  const [isDpaModalOpen, setIsDpaModalOpen] = useState(false);
  const [trackerInitialToken, setTrackerInitialToken] = useState('');

  const fileInputRef = useRef(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.talentops.ai.id';

  // Fetch Jobs on Mount
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/careers`);
      if (res && res.ok) {
        const json = await res.json();
        const activeJobs = json.data && json.data.length > 0 ? json.data : [];
        setJobs(activeJobs);
        // Preselect hanya kalau id-nya benar-benar ada di daftar aktif; kalau
        // lowongan sudah ditutup, biarkan kosong daripada memasang entri hantu.
        const preselected = requestedJobId
          ? activeJobs.find((j) => String(j.id) === String(requestedJobId))
          : null;
        setSelectedJob(preselected || null);
      } else {
        setJobs([]);
        setSelectedJob(null);
      }
    } catch (err) {
      console.warn('Failed to fetch job list:', err);
      setJobs([]);
      setSelectedJob(null);
    } finally {
      setLoadingJobs(false);
    }
  };

  // File drag & drop validation
  const validateAndSetFile = (file) => {
    setFileError(null);
    if (!file) return;

    const validExtensions = ['.pdf', '.docx'];
    const fileName = file.name.toLowerCase();
    const isValidExt = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExt) {
      setFileError('Format berkas tidak didukung. Harap unggah dokumen berformat PDF atau DOCX.');
      return;
    }

    if (file.size === 0) {
      setFileError('Berkas kosong (0 bytes) atau terkorupsi. Harap unggah berkas dokumen yang valid.');
      return;
    }

    if (fileName.includes('.exe') || fileName.includes('.sh') || fileName.includes('.bat') || fileName.includes('.js')) {
      setFileError('Ekstensi berkas mencurigakan terdeteksi. Sistem keamanan menolak berkas executable.');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError('Ukuran berkas melebihi batas maksimal 10 MB.');
      return;
    }

    setResumeFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedJob) {
      setSubmitError('Pilih salah satu posisi lowongan kerja yang tersedia.');
      return;
    }

    if (!name.trim()) {
      setSubmitError('Nama lengkap wajib diisi.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setSubmitError('Email aktif yang valid wajib diisi.');
      return;
    }

    if (!resumeFile) {
      setSubmitError('Unggah berkas resume/CV Anda dalam format PDF atau DOCX.');
      return;
    }

    if (!dpaConsent) {
      setSubmitError('Persetujuan Pemrosesan Data Pribadi (DPA) sesuai UU PDP No. 27/2022 wajib dicentang.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim());
      if (phone.trim()) formData.append('phone', phone.trim());
      if (githubUrl.trim()) formData.append('github_url', githubUrl.trim());
      if (portfolioUrl.trim()) formData.append('portfolio_url', portfolioUrl.trim());
      formData.append('dpa_consent', 'true');
      formData.append('resume_file', resumeFile);

      const res = await fetch(`${API_BASE_URL}/api/careers/${selectedJob.id}/apply`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setIssuedResult({
          maskedIdentifier: data.masked_identifier,
          trackingToken: data.tracking_token,
          jobTitle: selectedJob.title,
          piiStats: data.pii_sanitization_stats,
        });

        try {
          localStorage.setItem(`talentops_app_${data.tracking_token}`, JSON.stringify({
            masked_identifier: data.masked_identifier,
            job_title: selectedJob.title,
            department: selectedJob.department || 'Core Engineering',
            status: 'queued',
            recommendation: 'REVIEW_REQUIRED',
            submitted_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
            source: 'LIVE_DATABASE'
          }));
        } catch (e) {
          // The token is already on screen in the modal, so this is not fatal —
          // but the applicant must know the browser did not keep a copy.
          console.warn('Could not cache tracking token locally:', e);
        }

        // Clear form
        setName('');
        setEmail('');
        setPhone('');
        setGithubUrl('');
        setPortfolioUrl('');
        setResumeFile(null);
        setDpaConsent(false);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setSubmitError(errorData.detail || `Gagal mengirim lamaran (Kode respon ${res.status}).`);
      }
    } catch (err) {
      // Never invent a tracking token here. An earlier version minted a random
      // UUID on network failure and showed the success modal, so the applicant
      // believed the application was queued while the backend never saw it.
      console.warn('Application submit failed:', err);
      setSubmitError(
        'Lamaran belum terkirim: koneksi ke server gagal. Periksa jaringan Anda lalu coba lagi — jangan tutup halaman ini sebelum token pelacakan muncul.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackNow = (token) => {
    setTrackerInitialToken(token);
    navigate(`/track/${encodeURIComponent(token)}`);
  };

  return (
    <PublicLayout>
      <div>
        {activeTab === 'track' ? (
          <ApplicationTracker 
            initialToken={urlToken || trackerInitialToken} 
            onBackToPortal={() => navigate('/lowongan')} 
          />
        ) : (
          <div>
            {/* 3. Hero Section with Dot Matrix & WebEkspor Highlight Marker */}
            <section className="relative pt-10 sm:pt-14 pb-12 sm:pb-16 overflow-hidden bg-white">
              <div aria-hidden="true" className="absolute inset-0 opacity-[0.04] bg-dot-matrix pointer-events-none"></div>
              <div className="relative container mx-auto max-w-7xl px-4 sm:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
                  <div className="lg:col-span-9 space-y-5 relative">
                    <span aria-hidden="true" className="hidden lg:block absolute -top-16 -left-4 font-jkt font-extrabold text-[180px] leading-none text-primary-slate-100 select-none -z-10">01</span>
                    
                    {/* Eyebrow Badge */}
                    <div className="inline-flex items-center gap-2 bg-primary-orange/10 border border-primary-orange/30 rounded-full pl-2 pr-4 py-1.5">
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary-orange">
                        <Compass className="size-3.5 text-white" />
                      </span>
                      <span className="font-jkt font-semibold text-[11px] tracking-[0.22em] uppercase text-primary-black">
                        Portal Publik Pelamar · Penyaringan Otomatis
                      </span>
                    </div>

                    {/* Main Headline with WebEkspor Orange Skewed Marker */}
                    <h1 className="font-jkt font-extrabold text-[2.25rem] sm:text-4xl lg:text-[3.25rem] text-primary-black leading-[1.06] tracking-tight">
                      Karier profesional berkeadilan <span className="relative inline-block"><span className="relative z-10 italic font-medium">tanpa bias</span><span aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-2.5 sm:h-3 lg:h-3.5 bg-primary-orange/60 -z-0 -skew-x-6"></span></span> demografi.
                    </h1>

                    <p className="font-jkt font-medium text-base lg:text-lg text-primary-slate-700 leading-relaxed max-w-2xl">
                      Unggah berkas CV Anda dengan jaminan privasi mutlak. Sistem TalentOps AI menyensor nama, gender, usia, dan kontak sebelum mengevaluasi kompetensi murni berbasis bukti nyata.
                    </p>
                  </div>

                  {/* Estimation / Guarantee Pill */}
                  <div className="hidden lg:flex lg:col-span-3 flex-col items-end gap-2 pb-2">
                    <span className="font-jkt font-semibold text-[11px] tracking-[0.22em] uppercase text-primary-slate-1100">Jaminan Layanan</span>
                    <span className="font-jkt italic font-medium text-xs text-primary-slate-600 text-right max-w-[14rem]">
                      Berkas Anda masuk antrean penyaringan. Hasilnya muncul di halaman Lacak Status setelah tim HR menjalankannya.
                    </span>
                  </div>
                </div>

                {/* 3 Value Pillars Bar (WebEkspor Cards) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 mt-8 border-t border-primary-border-100">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200">
                    <div className="w-9 h-9 rounded-lg bg-primary-black/5 flex items-center justify-center text-primary-black shrink-0">
                      <Lock className="w-4 h-4 text-primary-orange" />
                    </div>
                    <div>
                      <p className="font-jkt font-bold text-xs text-primary-black">Enkripsi AES-256-GCM</p>
                      <p className="font-jkt text-[11px] text-primary-slate-600">Sesuai UU PDP No. 27/2022</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200">
                    <div className="w-9 h-9 rounded-lg bg-primary-black/5 flex items-center justify-center text-primary-black shrink-0">
                      <EyeOff className="w-4 h-4 text-primary-blue" />
                    </div>
                    <div>
                      <p className="font-jkt font-bold text-xs text-primary-black">Penyensoran Dua Arah</p>
                      <p className="font-jkt text-[11px] text-primary-slate-600">Identitas terlindungi in-memory</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200">
                    <div className="w-9 h-9 rounded-lg bg-primary-black/5 flex items-center justify-center text-primary-black shrink-0">
                      <Cpu className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-jkt font-bold text-xs text-primary-black">Audit Kredensial 0 Halusinasi</p>
                      <p className="font-jkt text-[11px] text-primary-slate-600">Terhubung langsung basis data nyata</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Main Section: Job Selector & Application Form */}
            <section className="py-10 sm:py-14 bg-primary-slate-50">
              <div className="container mx-auto max-w-7xl px-4 sm:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Job Selector (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-jkt font-extrabold text-2xl text-primary-orange tabular-nums">01</span>
                        <h2 className="font-jkt font-extrabold text-lg text-primary-black">
                          Pilih Posisi Lowongan
                        </h2>
                      </div>
                      <span className="font-jkt font-semibold text-xs text-primary-slate-600 bg-white px-2.5 py-1 rounded-full border border-primary-border-200">
                        {jobs.length} Posisi Aktif
                      </span>
                    </div>

                    {loadingJobs ? (
                      <div className="p-8 rounded-2xl border border-primary-border-200 bg-white flex flex-col items-center justify-center text-xs text-primary-slate-600 gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary-orange" />
                        <span>Memuat daftar lowongan kerja...</span>
                      </div>
                    ) : jobs.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-dashed border-primary-border-200 bg-white flex flex-col items-center justify-center text-center gap-2">
                        <Briefcase className="w-6 h-6 text-primary-slate-400" />
                        <p className="text-sm font-bold text-primary-black">Belum Ada Lowongan Aktif</p>
                        <p className="text-xs text-primary-slate-600 max-w-xs">
                          Saat ini tidak ada posisi yang dibuka. Silakan kembali lagi nanti.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {jobs.map((job) => {
                          const isSelected = selectedJob?.id === job.id;
                          return (
                            <div
                              key={job.id}
                              onClick={() => setSelectedJob(job)}
                              className={`p-5 rounded-2xl cursor-pointer transition-all duration-300 border bg-white ${
                                isSelected
                                  ? 'border-primary-orange shadow-md ring-2 ring-primary-orange/20'
                                  : 'border-primary-border-200 hover:border-primary-orange hover:shadow-card-hover'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-jkt font-bold text-[10px] tracking-wider uppercase text-primary-orange block mb-1">
                                    {job.department}
                                  </span>
                                  <h3 className="font-jkt font-bold text-primary-black text-base tracking-tight group-hover:text-primary-blue transition-colors">
                                    {job.title}
                                  </h3>
                                </div>
                                <span className="font-jkt font-semibold text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  Aktif
                                </span>
                              </div>

                              <p className="font-jkt text-xs text-primary-slate-600 mt-2 line-clamp-2 leading-relaxed">
                                {job.raw_text}
                              </p>

                              {/* Core Competencies Badges */}
                              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-primary-border-100">
                                {job.core_competencies?.slice(0, 4).map((tech, i) => (
                                  <span
                                    key={i}
                                    className="font-jkt font-semibold text-[10px] text-primary-black bg-primary-slate-50 border border-primary-border-200 rounded-md px-2 py-0.5 font-mono"
                                  >
                                    {tech}
                                  </span>
                                ))}
                                {job.core_competencies?.length > 4 && (
                                  <span className="text-[10px] text-primary-slate-400 self-center font-medium">
                                    +{job.core_competencies.length - 4} lainnya
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Privacy Guarantee Box */}
                    <div className="p-5 rounded-2xl bg-white border border-primary-border-200 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary-black font-jkt">
                        <ShieldCheck className="w-4 h-4 text-primary-orange" />
                        <span>Jaminan Kerahasiaan Identitas (UU PDP)</span>
                      </div>
                      <p className="text-xs text-primary-slate-600 leading-relaxed font-jkt">
                        Nama, kontak, dan asal kampus Anda dienkripsi lokal dengan kunci AES-256-GCM. Evaluasi awal murni menguji kesesuaian taksonomi keahlian dan artefak kode.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Application Form (7 cols) */}
                  <div className="lg:col-span-7">
                    <div className="rounded-2xl border border-primary-border-200 bg-white p-6 sm:p-8 shadow-sm">
                      <div className="pb-5 mb-5 border-b border-primary-border-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-jkt font-extrabold text-2xl text-primary-orange tabular-nums">02</span>
                          <span className="font-jkt font-bold text-xs uppercase tracking-[0.18em] text-primary-slate-1100">
                            Formulir Lamaran Resmi
                          </span>
                        </div>
                        <h2 className="font-jkt font-extrabold text-xl sm:text-2xl text-primary-black tracking-tight">
                          Lamar Posisi: {selectedJob ? selectedJob.title : 'Pilih Lowongan'}
                        </h2>
                        <p className="font-jkt text-xs text-primary-slate-600 mt-1">
                          Isi data diri Anda dan unggah berkas CV/Resume (PDF atau DOCX) untuk memulai proses seleksi otonom berkeadilan.
                        </p>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4 font-jkt">
                        {/* Input: Full Name */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-primary-black">
                              Nama Lengkap <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] text-primary-orange font-semibold flex items-center gap-1 bg-primary-orange/10 px-2 py-0.5 rounded-full border border-primary-orange/20">
                              <Lock className="w-2.5 h-2.5" /> Enkripsi AES-256-GCM
                            </span>
                          </div>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Budi Santoso"
                            className="w-full px-4 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-slate-900 placeholder:text-primary-slate-400 focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
                          />
                        </div>

                        {/* Input: Email & Phone Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-primary-black">
                                Email Aktif <span className="text-rose-500">*</span>
                              </label>
                              <span className="text-[10px] text-primary-slate-400 font-mono">
                                Blind Index HMAC
                              </span>
                            </div>
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="nama@domain.com"
                              className="w-full px-4 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-slate-900 placeholder:text-primary-slate-400 focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-primary-black">
                              Nomor Telepon / WhatsApp <span className="text-[10px] font-normal text-primary-slate-400">(Opsional)</span>
                            </label>
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="+62 812-3456-7890"
                              className="w-full px-4 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-slate-900 placeholder:text-primary-slate-400 focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
                            />
                          </div>
                        </div>

                        {/* Input: GitHub & Portfolio Grid */}
                        <div className={`grid grid-cols-1 ${selectedJob?.is_tech_role !== false ? 'sm:grid-cols-2' : ''} gap-4`}>
                          {selectedJob?.is_tech_role !== false && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-primary-black">
                                URL Profil / Repo GitHub <span className="text-[10px] font-normal text-primary-slate-400">(Opsional)</span>
                              </label>
                              <input
                                type="url"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                placeholder="https://github.com/username/project"
                                className="w-full px-4 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-slate-900 placeholder:text-primary-slate-400 focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
                              />
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-primary-black">
                              {selectedJob?.is_tech_role !== false ? 'Link Portofolio / Website' : 'Tautan Portofolio / Berkas Karya'}{' '}
                              <span className="text-[10px] font-normal text-primary-slate-400">(Opsional)</span>
                            </label>
                            <input
                              type="url"
                              value={portfolioUrl}
                              onChange={(e) => setPortfolioUrl(e.target.value)}
                              placeholder={selectedJob?.is_tech_role !== false ? 'https://portfolio-anda.dev' : 'https://drive.google.com/..., https://notion.so/..., atau LinkedIn'}
                              className="w-full px-4 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-slate-900 placeholder:text-primary-slate-400 focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
                            />
                          </div>
                        </div>

                        {/* Drag-and-Drop Resume Uploader */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-primary-black">
                            Unggah Resume / CV <span className="text-rose-500">*</span>
                          </label>

                          {resumeFile ? (
                            <div className="p-4 rounded-xl bg-primary-slate-50 border border-primary-border-200 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-primary-orange text-white flex items-center justify-center shrink-0 shadow-xs">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-primary-black truncate">{resumeFile.name}</p>
                                  <p className="text-[11px] text-primary-slate-600">
                                    {(resumeFile.size / 1024 / 1024).toFixed(2)} MB &bull; Valid Magic Bytes
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setResumeFile(null);
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="p-2 rounded-xl text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
                                title="Hapus berkas"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-all duration-300 ${
                                isDragging
                                  ? 'border-primary-orange bg-primary-orange/5 scale-[1.01]'
                                  : 'border-primary-border-200 hover:border-primary-orange bg-primary-slate-50/50 hover:bg-primary-slate-50'
                              }`}
                            >
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    validateAndSetFile(e.target.files[0]);
                                  }
                                }}
                              />
                              <div className="w-12 h-12 mx-auto rounded-xl bg-white border border-primary-border-200 flex items-center justify-center text-primary-orange shadow-xs mb-3">
                                <UploadCloud className="w-6 h-6" />
                              </div>
                              <p className="text-xs font-bold text-primary-black">
                                Tarik & Lepaskan Berkas Resume Di Sini, atau <span className="text-primary-orange underline">Pilih Berkas</span>
                              </p>
                              <p className="text-[11px] text-primary-slate-400 mt-1">
                                Mendukung format PDF atau DOCX (Maksimal 10 MB)
                              </p>
                            </div>
                          )}

                          {fileError && (
                            <p className="text-xs text-rose-600 flex items-center gap-1.5 pt-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{fileError}</span>
                            </p>
                          )}
                        </div>

                        {/* DPA Legal Consent Checkbox */}
                        <div className="p-4 rounded-xl bg-primary-slate-50 border border-primary-border-200 space-y-2">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              id="dpa-consent"
                              checked={dpaConsent}
                              onChange={(e) => setDpaConsent(e.target.checked)}
                              className="w-4 h-4 mt-0.5 rounded text-primary-orange focus:ring-primary-orange border-primary-border-200 cursor-pointer"
                            />
                            <label htmlFor="dpa-consent" className="text-xs text-primary-slate-700 cursor-pointer select-none leading-relaxed">
                              Saya menyetujui Pemrosesan Data Pribadi sesuai ketentuan <strong>UU PDP No. 27 Tahun 2022</strong>. Saya memahami identitas saya akan disanitasi dari bias demografis sebelum dianalisis oleh AI, dan saya memiliki hak pencabutan data (<em>Right to Erasure</em>) sewaktu-waktu.{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsDpaModalOpen(true);
                                }}
                                className="text-primary-orange hover:underline font-bold inline-flex items-center gap-0.5 ml-1"
                              >
                                <span>Baca Ketentuan DPA</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </label>
                          </div>
                        </div>

                        {submitError && (
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{submitError}</span>
                          </div>
                        )}

                        {/* Submit Button (WebEkspor Rounded-Full Orange Button) */}
                        <button
                          type="submit"
                          disabled={submitting || !selectedJob}
                          title={!selectedJob ? 'Pilih salah satu posisi lowongan terlebih dahulu' : undefined}
                          className="w-full py-3.5 px-6 rounded-full bg-primary-orange hover:opacity-90 disabled:opacity-60 text-white font-jkt font-bold text-xs shadow-lg shadow-primary-orange/25 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Mengenkripsi & Mengirim Lamaran ke Antrean Penyaringan...</span>
                            </>
                          ) : (
                            <>
                              <span>Kirim Lamaran & Dapatkan Token Pelacakan</span>
                              <ArrowRight className="w-4 h-4 text-white" />
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. WebEkspor Bottom Navy Banner Section with Huge Arrow */}
            <section className="relative pt-12 sm:pt-16 pb-20 sm:pb-28 overflow-hidden bg-white">
              <div className="container mx-auto max-w-7xl px-4 sm:px-6">
                <div className="relative overflow-hidden rounded-3xl bg-primary-black px-6 py-12 sm:px-12 sm:py-14 lg:px-16 lg:py-16 text-white">
                  <span aria-hidden="true" className="pointer-events-none absolute -top-12 -right-4 sm:-right-2 font-jkt font-extrabold text-[180px] sm:text-[260px] lg:text-[320px] leading-none text-white/[0.05] select-none">
                    →
                  </span>
                  <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end">
                    <div className="lg:col-span-7 space-y-4">
                      <span className="font-jkt font-semibold text-[11px] tracking-[0.22em] uppercase text-primary-orange">
                        Transparansi Penuh
                      </span>
                      <h2 className="font-jkt font-extrabold text-[1.75rem] sm:text-[2.25rem] lg:text-[2.75rem] text-white leading-[1.08]">
                        Pantau status berkas Anda secara <span className="relative inline-block"><span className="relative z-10 italic font-medium text-white">real-time</span><span aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-2.5 sm:h-3 bg-primary-orange/70 -z-0 -skew-x-6"></span></span> dan mandiri.
                      </h2>
                      <p className="font-jkt font-medium text-sm sm:text-base text-primary-slate-300 leading-relaxed max-w-xl">
                        Simpan Secret Tracking Token Anda dengan aman. Lacak setiap tahapan evaluasi tanpa perlu menghubungi rekruter secara manual.
                      </p>
                    </div>
                    <div className="lg:col-span-5 flex flex-col gap-3 lg:items-stretch">
                      <button
                        onClick={() => navigate('/track')}
                        className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary-orange px-6 py-3.5 font-jkt font-semibold text-sm text-white shadow-lg shadow-primary-orange/25 transition-opacity hover:opacity-90"
                      >
                        <Search className="w-4 h-4 text-white" />
                        <span>Buka Menu Lacak Berkas</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (onBackToDashboard) onBackToDashboard();
                          else navigate('/admin/dashboard');
                        }}
                        className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 font-jkt font-semibold text-sm text-white transition-colors hover:border-white/40 hover:bg-white/10"
                      >
                        <Building2 className="w-4 h-4 text-white" />
                        <span>Akses Recruiter Workspace (Admin)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* DPA Modal */}
      <DpaModal
        isOpen={isDpaModalOpen}
        onClose={() => setIsDpaModalOpen(false)}
        onAccept={() => setDpaConsent(true)}
      />

      {/* Token Issued Success Modal */}
      <TokenIssuedModal
        isOpen={!!issuedResult}
        onClose={() => setIssuedResult(null)}
        maskedIdentifier={issuedResult?.maskedIdentifier}
        trackingToken={issuedResult?.trackingToken}
        jobTitle={issuedResult?.jobTitle}
        piiStats={issuedResult?.piiStats}
        onTrackNow={handleTrackNow}
      />
    </PublicLayout>
  );
}
