import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Lock,
  Briefcase,
  User,
  Mail,
  RefreshCw,
  Info,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export default function UploadCandidateModal({ isOpen, onClose, onUploadSuccess }) {
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('Senior Backend Engineer');
  const [selectedJobId, setSelectedJobId] = useState('1');
  const [jobsList, setJobsList] = useState([]);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  // Sanitization report returned by POST /api/candidates/upload. Kept in state so
  // the residual-risk signal is visible instead of being discarded on close.
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/jobs`);
        if (res && res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setJobsList(json.data);
            setSelectedJobId(String(json.data[0].id));
            setJobTitle(json.data[0].title);
          }
        }
      } catch (e) {
        // Falls through to the placeholder option list below; log so a dead
        // /api/jobs is diagnosable instead of looking like an empty dropdown.
        console.warn('Job list unavailable for upload modal:', e);
      }
    }
    if (isOpen) {
      setUploadResult(null);
      loadJobs();
    }
  }, [isOpen, API_BASE_URL]);

  if (!isOpen) return null;

  const validateAndSetFile = (selectedFile) => {
    setFileError(null);
    const validExtensions = ['.pdf', '.docx'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      setFileError('Format berkas harus PDF atau DOCX.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setFileError('Ukuran berkas tidak boleh melebihi 10 MB.');
      return;
    }

    setFile(selectedFile);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setFileError('Silakan pilih berkas CV/Resume (PDF atau DOCX).');
      return;
    }

    const trimmedName = candidateName.trim();
    const trimmedEmail = candidateEmail.trim();
    if (!trimmedName) {
      setErrorMessage('Nama lengkap pelamar wajib diisi.');
      return;
    }
    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      setErrorMessage('Email pelamar tidak valid.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('job_id', String(selectedJobId || '1'));
      formData.append('files', file);
      // Backend encrypts this and uses it for review emails + PII unmasking. Without
      // it the dropzone stores placeholders and the applicant can never be contacted.
      formData.append('applicant_meta', JSON.stringify([{ name: trimmedName, email: trimmedEmail }]));

      let serverUploaded = null;
      let uploadError = null;
      try {
        const res = await fetch(`${API_BASE_URL}/api/candidates/upload`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.candidates || data.uploaded_candidates || [];
          if (list.length > 0) {
            serverUploaded = list[0];
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          uploadError = errData.detail || `Server error ${res.status}`;
        }
      } catch (networkErr) {
        uploadError = 'Koneksi ke server gagal. Pastikan backend aktif.';
      }

      if (uploadError || !serverUploaded) {
        setErrorMessage(uploadError || 'Upload berhasil dikirim namun respons kandidat tidak diterima dari server. Refresh dashboard untuk memperbarui data.');
        setIsSubmitting(false);
        return;
      }

      const newCandidate = {
        id: serverUploaded.candidate_id || serverUploaded.id,
        masked_identifier: serverUploaded.masked_identifier,
        tracking_token: serverUploaded.tracking_token,
        job_title: jobTitle,
        applied_date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        candidate_name_masked: serverUploaded.masked_identifier,
        overall_score: null,
        scores_4d: null,
        recommendation: 'PENDING_SCAN',
        status: 'queued',
        scan_status: 'UNSCANNED',
        confidence_level: null,
        verified_github: null,
        github_status: 'PENDING_SCAN',
        flags: [],
        key_technologies: [],
        resume_file_name: file.name
      };

      if (onUploadSuccess) {
        onUploadSuccess(newCandidate);
      }

      // Keep the modal open when the sanitizer flagged residual risk: closing
      // straight away would hide the only signal that a name survived redaction.
      if (serverUploaded.sanitization) {
        setUploadResult(serverUploaded.sanitization);
        setFile(null);
        return;
      }

      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Gagal mengunggah berkas kandidat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (uploadResult) {
    const risky = Boolean(uploadResult.residual_risk);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-2xl border border-primary-border-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-5 border-b border-primary-border-200 flex items-center justify-between bg-primary-slate-100">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs ${risky ? 'bg-amber-500' : 'bg-primary-orange'}`}>
                {risky ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-primary-slate-900 font-display">
                  Berkas Masuk Antrean
                </h3>
                <p className="text-xs text-primary-slate-600">
                  Laporan sanitasi PII untuk berkas yang baru diunggah
                </p>
              </div>
            </div>
            <button
              aria-label="Tutup dialog unggah"
              onClick={onClose}
              className="p-1.5 rounded-lg text-primary-slate-600 hover:text-primary-slate-900 hover:bg-primary-border-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto font-jkt">
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              risky
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-primary-orange/5 border-primary-orange/20 text-primary-slate-900'
            }`}>
              {risky ? <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> : <ShieldCheck className="w-4 h-4 text-primary-orange shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <p className="font-bold">
                  {risky ? 'PII_RESIDUAL_RISK — perlu tinjauan manual' : 'Sanitasi PII bersih'}
                </p>
                <p className="leading-relaxed">
                  {risky
                    ? 'Terdeteksi kemungkinan nama yang belum teredaksi di narasi bebas. Berkas tetap masuk antrean, namun wajib diperiksa manual sebelum dipakai.'
                    : 'Seluruh entitas PII yang terdeteksi berhasil diredaksi dari teks resume.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-primary-slate-100 border border-primary-border-200 space-y-2 text-xs">
              <div className="flex justify-between gap-3 py-1 border-b border-primary-border-200">
                <span className="text-primary-slate-600">Nama terdeteksi</span>
                <span className="font-mono font-bold text-primary-slate-900 text-right break-all">
                  {uploadResult.detected_name || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <span className="text-primary-slate-600">Sumber nama</span>
                <span className="font-mono font-bold text-primary-info">{uploadResult.name_source || '—'}</span>
              </div>
            </div>

            {Array.isArray(uploadResult.limitations) && uploadResult.limitations.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-600">
                  Batasan yang dilaporkan sanitizer
                </span>
                <ul className="space-y-1">
                  {uploadResult.limitations.map((lim, idx) => (
                    <li key={idx} className="p-2.5 rounded-lg bg-white border border-primary-border-200 text-[11px] text-primary-slate-700 leading-snug flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-primary-info shrink-0 mt-0.5" />
                      <span>{lim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-primary-orange hover:bg-primary-orange-dark text-white text-xs font-bold transition-all shadow-xs"
              >
                Mengerti &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl border border-primary-border-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-primary-border-200 flex items-center justify-between bg-primary-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-info text-white flex items-center justify-center shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary-slate-900 font-display">
                Upload CV Pelamar Baru
              </h3>
              <p className="text-xs text-primary-slate-600">
                Berkas akan masuk antrean dalam status <strong>Belum Di-scan</strong>
              </p>
            </div>
          </div>
          <button
            aria-label="Tutup laporan sanitasi"
            onClick={onClose}
            className="p-1.5 rounded-lg text-primary-slate-600 hover:text-primary-slate-900 hover:bg-primary-border-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Candidate Name Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-primary-slate-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary-info" />
                <span>Nama Lengkap Pelamar *</span>
              </label>
              <span className="text-[10px] text-primary-info font-semibold flex items-center gap-1 bg-primary-info-soft px-2 py-0.5 rounded-full border border-primary-info-border">
                <Lock className="w-2.5 h-2.5" /> Sensor UU PDP
              </span>
            </div>
            <input
              type="text"
              required
              placeholder="Contoh: Ahmad Rizky Pratama"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-primary-slate-300 bg-white text-xs text-primary-slate-900 placeholder-primary-slate-600 focus:outline-none focus:border-primary-info focus:ring-1 focus:ring-primary-info/20"
            />
          </div>

          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary-slate-900 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-primary-info" />
              <span>Email Pelamar *</span>
            </label>
            <input
              type="email"
              required
              placeholder="ahmad.rizky@example.com"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-primary-slate-300 bg-white text-xs text-primary-slate-900 placeholder-primary-slate-600 focus:outline-none focus:border-primary-info focus:ring-1 focus:ring-primary-info/20"
            />
          </div>

          {/* Job Position Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary-slate-900 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-primary-info" />
              <span>Posisi yang Dilamar *</span>
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => {
                const jid = e.target.value;
                setSelectedJobId(jid);
                const found = jobsList.find(j => String(j.id) === String(jid));
                if (found) setJobTitle(found.title);
              }}
              className="w-full px-3.5 py-2.5 rounded-lg border border-primary-slate-300 bg-white text-xs text-primary-slate-900 font-medium focus:outline-none focus:border-primary-info"
            >
              {jobsList.length > 0 ? (
                jobsList.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.department || 'Engineering'})
                  </option>
                ))
              ) : (
                <>
                  <option value="1">Senior Backend Engineer (Core Engineering)</option>
                  <option value="2">AI Data &amp; Evaluation Engineer (AI Group)</option>
                  <option value="3">Lead Frontend UI/UX Engineer (Product)</option>
                </>
              )}
            </select>
          </div>

          {/* Dropzone File Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary-slate-900">
              Unggah Berkas CV / Resume *
            </label>

            {file ? (
              <div className="p-3.5 rounded-xl bg-primary-info-soft border border-primary-info-border flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-6 h-6 text-primary-info shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary-slate-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-primary-slate-600">
                      {(file.size / 1024).toFixed(1)} KB &bull; Siap dimasukkan antrean
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 rounded-lg text-primary-slate-600 hover:text-rose-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-primary-info bg-primary-info-soft'
                    : 'border-primary-slate-300 hover:border-primary-info bg-primary-slate-100/50 hover:bg-primary-slate-100'
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
                <div className="w-10 h-10 mx-auto rounded-xl bg-white border border-primary-border-200 flex items-center justify-center text-primary-info shadow-xs mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-primary-slate-900">
                  Klik untuk pilih berkas, atau tarik &amp; lepas ke sini
                </p>
                <p className="text-[10px] text-primary-slate-600 mt-0.5">
                  Mendukung format PDF atau DOCX (Maksimal 10 MB)
                </p>
              </div>
            )}

            {fileError && (
              <p className="text-xs text-rose-600 flex items-center gap-1 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fileError}</span>
              </p>
            )}
          </div>

          {/* Privacy & On-Demand Notice */}
          <div className="p-3 rounded-lg bg-primary-slate-100 border border-primary-border-200 text-[11px] text-primary-slate-700 flex items-start gap-2">
            <Info className="w-4 h-4 text-primary-info shrink-0 mt-0.5" />
            <span>
              <strong>Kendali Penuh HR:</strong> Berkas akan tersimpan aman tanpa langsung diproses oleh AI. Anda dapat memicu <strong>"Mulai Analisis AI"</strong> kapan pun Anda siap.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-primary-slate-300 text-xs font-semibold text-primary-slate-900 hover:bg-primary-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !file}
              className="px-5 py-2.5 rounded-xl bg-primary-orange hover:bg-primary-orange-dark disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan ke Antrean...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan ke Antrean Pelamar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
