import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Clock,
  Lock,
  FileText,
  Trash2,
  UploadCloud,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import PublicLayout from './PublicLayout';
import DpaModal from '../DpaModal';
import TokenIssuedModal from '../TokenIssuedModal';
import { API_BASE_URL } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function JobApplyPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [jobError, setJobError] = useState(null);

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

  const fileInputRef = useRef(null);

  // Fetch specific job details on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingJob(true);
      setJobError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/careers/${id}`);
        if (res.status === 404) {
          if (!cancelled) setJobError('Lowongan tidak ditemukan atau sudah ditutup.');
          return;
        }
        if (!res.ok) throw new Error(`Server merespons ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          if (data.status && data.status !== 'active') {
            setJobError('Lowongan ini sudah tidak menerima lamaran baru.');
          } else {
            setJob(data);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat lowongan:', err);
        if (!cancelled) setJobError('Gagal memuat rincian lowongan. Periksa koneksi internet Anda.');
      } finally {
        if (!cancelled) setLoadingJob(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // File validation
  const validateAndSetFile = (file) => {
    setFileError(null);
    if (!file) return;

    const validExtensions = ['.pdf', '.docx'];
    const fileName = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidExt) {
      setFileError('Format berkas tidak didukung. Harap unggah dokumen berformat PDF atau DOCX.');
      return;
    }

    if (file.size === 0) {
      setFileError('Berkas kosong (0 bytes) atau terkorupsi. Harap unggah berkas dokumen yang valid.');
      return;
    }

    if (
      fileName.includes('.exe') ||
      fileName.includes('.sh') ||
      fileName.includes('.bat') ||
      fileName.includes('.js')
    ) {
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

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!job) {
      setSubmitError('Lowongan tidak valid.');
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

      const res = await fetch(`${API_BASE_URL}/api/careers/${job.id}/apply`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setIssuedResult({
          maskedIdentifier: data.masked_identifier,
          trackingToken: data.tracking_token,
          jobTitle: job.title,
          piiStats: data.pii_sanitization_stats,
        });

        try {
          localStorage.setItem(
            `talentops_app_${data.tracking_token}`,
            JSON.stringify({
              masked_identifier: data.masked_identifier,
              job_title: job.title,
              department: job.department || 'Core Engineering',
              status: 'queued',
              recommendation: 'REVIEW_REQUIRED',
              submitted_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
              source: 'LIVE_DATABASE',
            })
          );
        } catch (errLocal) {
          console.warn('Gagal menyimpan cache token di localStorage:', errLocal);
        }

        // Reset form
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
      console.warn('Gagal mengirim lamaran:', err);
      setSubmitError(
        'Lamaran belum terkirim: koneksi ke server gagal. Periksa jaringan Anda lalu coba lagi.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackNow = (token) => {
    navigate(`/track/${encodeURIComponent(token)}`);
  };

  const deadlinePassed = job?.deadline && new Date(job.deadline) < new Date();

  return (
    <PublicLayout>
      <div className="bg-primary-slate-50 py-8 sm:py-12 min-h-[calc(100vh-200px)]">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">
          {/* Breadcrumb / Back Navigation */}
          <div className="mb-6">
            <Link
              to={job ? `/lowongan/${job.id}` : '/lowongan'}
              className="inline-flex items-center gap-2 text-xs font-bold text-primary-slate-600 hover:text-primary-orange transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{job ? 'Kembali ke Rincian Lowongan' : 'Kembali ke Daftar Lowongan'}</span>
            </Link>
          </div>

          {loadingJob ? (
            <div className="rounded-2xl border border-primary-border-200 bg-white p-12 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-primary-orange" />
              <p className="text-xs font-semibold text-primary-slate-600">Memuat rincian lowongan...</p>
            </div>
          ) : jobError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h2 className="text-sm font-bold text-rose-900">{jobError}</h2>
              <p className="text-xs text-rose-700">Silakan pilih lowongan lain yang masih aktif pada papan karier.</p>
              <Link
                to="/lowongan"
                className="inline-block px-5 py-2.5 rounded-full bg-primary-black text-white text-xs font-bold hover:bg-primary-orange transition-colors"
              >
                Lihat Semua Lowongan
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Job Target Summary Card */}
              <div className="rounded-2xl border border-primary-border-200 bg-white p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-primary-orange block mb-1">
                      {job.department || 'Lowongan Kerja'}
                    </span>
                    <h1 className="font-extrabold text-xl sm:text-2xl text-primary-black tracking-tight">
                      {job.title}
                    </h1>
                    <p className="text-xs font-semibold text-primary-blue mt-1">
                      {job.company_name || 'TalentOps AI Ecosystem'}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-end gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Lowongan Terbuka
                    </span>
                    {job.deadline && (
                      <span className={`text-[11px] flex items-center gap-1 font-medium ${deadlinePassed ? 'text-rose-600' : 'text-primary-slate-500'}`}>
                        <Clock className="w-3 h-3" />
                        {deadlinePassed ? 'Batas lamar terlewat' : `Batas: ${formatDate(job.deadline)}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-primary-border-100 text-xs text-primary-slate-600">
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

                {job.core_competencies?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-primary-border-100">
                    <span className="text-[11px] font-bold text-primary-slate-700 self-center mr-1">
                      Kompetensi Kunci:
                    </span>
                    {job.core_competencies.map((tech, i) => (
                      <span
                        key={i}
                        className="font-mono text-[10px] font-semibold text-primary-black bg-primary-slate-50 border border-primary-border-200 rounded-md px-2 py-0.5"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Privacy Notice Pill */}
              <div className="p-4 rounded-xl bg-primary-orange/5 border border-primary-orange/20 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary-orange shrink-0 mt-0.5" />
                <div className="text-xs text-primary-slate-700 leading-relaxed">
                  <strong className="text-primary-black font-bold">Privasi 100% Terenkripsi (UU PDP No. 27/2022):</strong>{' '}
                  Nama, nomor kontak, dan asal kampus disanitasi otomatis sebelum dievaluasi agen AI. Penilaian murni berbasis bukti kompetensi teknis.
                </div>
              </div>

              {/* Main Application Form */}
              <div className="rounded-2xl border border-primary-border-200 bg-white p-6 sm:p-8 shadow-xs">
                <div className="pb-5 mb-5 border-b border-primary-border-100">
                  <h2 className="font-extrabold text-lg sm:text-xl text-primary-black tracking-tight">
                    Formulir Lamaran Kandidat
                  </h2>
                  <p className="text-xs text-primary-slate-600 mt-1">
                    Isi data diri Anda dan unggah berkas CV/Resume (PDF atau DOCX) untuk memulai proses seleksi.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
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

                  {/* Email & Phone */}
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

                  {/* GitHub & Portfolio */}
                  <div className={`grid grid-cols-1 ${job.is_tech_role !== false ? 'sm:grid-cols-2' : ''} gap-4`}>
                    {job.is_tech_role !== false && (
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
                        {job.is_tech_role !== false ? 'Link Portofolio / Website' : 'Tautan Portofolio / Berkas Karya'}{' '}
                        <span className="text-[10px] font-normal text-primary-slate-400">(Opsional)</span>
                      </label>
                      <input
                        type="url"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder={job.is_tech_role !== false ? 'https://portfolio-anda.dev' : 'https://drive.google.com/..., https://notion.so/..., atau LinkedIn'}
                        className="w-full px-4 py-2.5 rounded-xl border border-primary-border-200 bg-white text-xs text-primary-slate-900 placeholder:text-primary-slate-400 focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Resume Upload Dropzone */}
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
                          Tarik & Lepaskan Berkas Resume Di Sini, atau{' '}
                          <span className="text-primary-orange underline">Pilih Berkas</span>
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

                  {/* DPA Consent Checkbox */}
                  <div className="p-4 rounded-xl bg-primary-slate-50 border border-primary-border-200 space-y-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="dpa-consent"
                        checked={dpaConsent}
                        onChange={(e) => setDpaConsent(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-primary-orange focus:ring-primary-orange border-primary-border-200 cursor-pointer"
                      />
                      <label
                        htmlFor="dpa-consent"
                        className="text-xs text-primary-slate-700 cursor-pointer select-none leading-relaxed"
                      >
                        Saya menyetujui Pemrosesan Data Pribadi sesuai ketentuan{' '}
                        <strong>UU PDP No. 27 Tahun 2022</strong>. Saya memahami identitas saya akan disanitasi dari
                        bias demografis sebelum dianalisis oleh AI, dan saya memiliki hak pencabutan data (
                        <em>Right to Erasure</em>) sewaktu-waktu.{' '}
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

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting || deadlinePassed}
                    className="w-full py-3.5 px-6 rounded-full bg-primary-orange hover:opacity-90 disabled:opacity-60 text-white font-bold text-xs shadow-lg shadow-primary-orange/25 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Mengenkripsi & Mengirim Lamaran...</span>
                      </>
                    ) : (
                      <span>Kirim Lamaran Sekarang</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {issuedResult && (
        <TokenIssuedModal
          isOpen={true}
          onClose={() => {
            setIssuedResult(null);
            navigate(`/track/${encodeURIComponent(issuedResult.trackingToken)}`);
          }}
          maskedIdentifier={issuedResult.maskedIdentifier}
          trackingToken={issuedResult.trackingToken}
          jobTitle={issuedResult.jobTitle}
          piiStats={issuedResult.piiStats}
          onTrackNow={handleTrackNow}
        />
      )}

      {/* DPA Modal */}
      <DpaModal isOpen={isDpaModalOpen} onClose={() => setIsDpaModalOpen(false)} />
    </PublicLayout>
  );
}
