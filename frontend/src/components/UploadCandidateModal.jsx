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
  Sparkles,
  Info
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
      } catch (e) {}
    }
    if (isOpen) {
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

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('job_id', String(selectedJobId || '1'));
      formData.append('files', file);

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

      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Gagal mengunggah berkas kandidat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl border border-[#e6e6ea] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#e6e6ea] flex items-center justify-between bg-[#f4f4f6]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1b55f5] text-white flex items-center justify-center shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#000000] font-display">
                Upload CV Pelamar Baru
              </h3>
              <p className="text-xs text-[#67677e]">
                Berkas akan masuk antrean dalam status <strong>Belum Di-scan</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#67677e] hover:text-[#000000] hover:bg-[#e6e6ea] transition-colors"
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
              <label className="text-xs font-bold text-[#000000] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#1b55f5]" />
                <span>Nama Lengkap Pelamar *</span>
              </label>
              <span className="text-[10px] text-[#1b55f5] font-semibold flex items-center gap-1 bg-[#eaf0ff] px-2 py-0.5 rounded-full border border-[#8ec0ff]">
                <Lock className="w-2.5 h-2.5" /> Sensor UU PDP
              </span>
            </div>
            <input
              type="text"
              required
              placeholder="Contoh: Ahmad Rizky Pratama"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#d8d8df] bg-white text-xs text-[#000000] placeholder-[#67677e] focus:outline-none focus:border-[#1b55f5] focus:ring-1 focus:ring-[#1b55f5]/20"
            />
          </div>

          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#000000] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#1b55f5]" />
              <span>Email Pelamar *</span>
            </label>
            <input
              type="email"
              required
              placeholder="ahmad.rizky@example.com"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#d8d8df] bg-white text-xs text-[#000000] placeholder-[#67677e] focus:outline-none focus:border-[#1b55f5] focus:ring-1 focus:ring-[#1b55f5]/20"
            />
          </div>

          {/* Job Position Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#000000] flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#1b55f5]" />
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
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#d8d8df] bg-white text-xs text-[#000000] font-medium focus:outline-none focus:border-[#1b55f5]"
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
            <label className="text-xs font-bold text-[#000000]">
              Unggah Berkas CV / Resume *
            </label>

            {file ? (
              <div className="p-3.5 rounded-xl bg-[#eaf0ff] border border-[#8ec0ff] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-6 h-6 text-[#1b55f5] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#000000] truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-[#67677e]">
                      {(file.size / 1024).toFixed(1)} KB &bull; Siap dimasukkan antrean
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 rounded-lg text-[#67677e] hover:text-rose-600 transition-colors"
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
                    ? 'border-[#1b55f5] bg-[#eaf0ff]'
                    : 'border-[#d8d8df] hover:border-[#1b55f5] bg-[#f4f4f6]/50 hover:bg-[#f4f4f6]'
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
                <div className="w-10 h-10 mx-auto rounded-xl bg-white border border-[#e6e6ea] flex items-center justify-center text-[#1b55f5] shadow-xs mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-[#000000]">
                  Klik untuk pilih berkas, atau tarik &amp; lepas ke sini
                </p>
                <p className="text-[10px] text-[#67677e] mt-0.5">
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
          <div className="p-3 rounded-lg bg-[#f4f4f6] border border-[#e6e6ea] text-[11px] text-[#454554] flex items-start gap-2">
            <Info className="w-4 h-4 text-[#1b55f5] shrink-0 mt-0.5" />
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
              className="px-4 py-2 rounded-lg border border-[#d8d8df] text-xs font-semibold text-[#000000] hover:bg-[#f4f4f6] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !file}
              className="px-5 py-2 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2"
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
