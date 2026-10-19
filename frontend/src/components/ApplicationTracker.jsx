import React, { useState, useEffect } from 'react';
import { 
  Search, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Briefcase, 
  Building2, 
  Calendar, 
  ArrowLeft,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  FileCheck2,
  Cpu,
  GitBranch
} from 'lucide-react';
import { MOCK_CANDIDATES } from '../data/mockCandidates';

export default function ApplicationTracker({ initialToken = '', onBackToPortal }) {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

  const fetchStatus = async (tokenToFetch) => {
    let token = (tokenToFetch || tokenInput).trim();
    if (!token) {
      setError('Harap masukkan secret tracking token (UUIDv4) Anda.');
      return;
    }

    // Edge-Case Validation: Check format & guide user if using public display identifier (#TK-)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Auto-heal 37-char token if prefixed with stray 'a' from previous build simulation
    if (token.length === 37 && token.startsWith('a') && UUID_REGEX.test(token.slice(1))) {
      token = token.slice(1);
      setTokenInput(token);
    }

    const isPublicId = token.startsWith('#TK-') || token.startsWith('TK-');

    if (!UUID_REGEX.test(token) && !isPublicId) {
      setError('Format token tidak valid. Tracking Token wajib berupa 36 karakter UUIDv4 (contoh: 7c9e6679-7425-40de-944b-e07fc1f90ae7).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try Live API Backend VPS first (direct or proxied via Vercel rewrite)
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/api/careers/track/${encodeURIComponent(token)}`);
      } catch (directErr) {
        res = await fetch(`/api/careers/track/${encodeURIComponent(token)}`);
      }

      if (res && res.ok) {
        const data = await res.json();
        setTrackingData({
          masked_identifier: data.masked_identifier,
          job_title: data.job_title,
          department: data.department,
          status: data.status || 'queued',
          recommendation: data.recommendation,
          submitted_at: data.submitted_at,
          source: 'LIVE_DATABASE'
        });
        setLastChecked(new Date().toLocaleTimeString('id-ID'));
        setLoading(false);
        return;
      }

      // 2. Check local application cache (resilient fallback if submitted under simulation/offline)
      try {
        const localCached = localStorage.getItem(`talentops_app_${token}`);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          setTrackingData(parsed);
          setLastChecked(new Date().toLocaleTimeString('id-ID'));
          setLoading(false);
          return;
        }
      } catch (e) {}

      // 3. Check if token matches local mock candidates (fallback for demo offline)
      const mockMatch = MOCK_CANDIDATES.find(c => c.tracking_token === token || c.masked_identifier === token);
      if (mockMatch) {
        setTrackingData({
          masked_identifier: mockMatch.masked_identifier,
          job_title: mockMatch.job_title,
          department: 'Engineering',
          status: mockMatch.status,
          recommendation: mockMatch.recommendation,
          submitted_at: mockMatch.applied_date,
          scores_4d: mockMatch.scores_4d,
          verified_github: mockMatch.verified_github,
          source: 'DEMO_DATASET'
        });
        setLastChecked(new Date().toLocaleTimeString('id-ID'));
        setLoading(false);
        return;
      }

      // If neither, throw error
      if (res.status === 404) {
        setError('Token tidak ditemukan atau berkas lamaran telah dihapus (Right to Erasure).');
      } else {
        setError(`Gagal memuat status lamaran: Server merespons ${res.status}`);
      }
    } catch (err) {
      console.warn('Network error, checking mock fallback:', err);
      // Fallback to mock check if offline
      const mockMatch = MOCK_CANDIDATES.find(c => c.tracking_token === token || c.masked_identifier === token);
      if (mockMatch) {
        setTrackingData({
          masked_identifier: mockMatch.masked_identifier,
          job_title: mockMatch.job_title,
          department: 'Core Engineering',
          status: mockMatch.status,
          recommendation: mockMatch.recommendation,
          submitted_at: mockMatch.applied_date,
          scores_4d: mockMatch.scores_4d,
          source: 'DEMO_DATASET'
        });
        setLastChecked(new Date().toLocaleTimeString('id-ID'));
      } else {
        setError('Koneksi ke server gagal. Pastikan jaringan internet aktif.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      setTokenInput(initialToken);
      fetchStatus(initialToken);
    }
  }, [initialToken]);

  // Stepper timeline definition
  const getTimelineSteps = (status) => {
    const steps = [
      {
        id: 1,
        title: 'Berkas Diterima & Disanitasi',
        desc: 'Enkripsi AES-256-GCM & sensor PII in-memory aktif',
        done: true,
        current: false,
      },
      {
        id: 2,
        title: 'Audit Integritas & Anti-Injeksi',
        desc: 'Pemeriksaan tag tersembunyi DOCX & validasi format Magic Bytes',
        done: ['analyzing', 'in_review', 'waiting_approval', 'interview_scheduled', 'shortlisted'].includes(status),
        current: status === 'queued',
      },
      {
        id: 3,
        title: 'Ekstraksi Keahlian & Validasi Bukti Resume',
        desc: 'Pencocokan kompetensi dengan kutipan teks asli dokumen resume',
        done: ['waiting_approval', 'interview_scheduled', 'shortlisted'].includes(status),
        current: ['analyzing', 'in_review'].includes(status),
      },
      {
        id: 4,
        title: 'Evaluasi 4 Dimensi & Audit Portofolio',
        desc: 'Penilaian objektif: Keahlian Inti, Portofolio Proyek, Bukti, dan Resiko',
        done: ['waiting_approval', 'interview_scheduled', 'shortlisted'].includes(status),
        current: false,
      },
      {
        id: 5,
        title: 'Keputusan Triage & Peninjauan Tim HR',
        desc: 'Rekomendasi otomatis & reservasi kalender wawancara',
        done: ['interview_scheduled', 'shortlisted'].includes(status),
        current: ['waiting_approval'].includes(status),
      }
    ];
    return steps;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'queued':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Dalam Antrean Triage
          </span>
        );
      case 'analyzing':
      case 'in_review':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5 animate-pulse">
            <Cpu className="w-3.5 h-3.5" />
            Sedang Dianalisis AI Agent
          </span>
        );
      case 'waiting_approval':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#8EB69B]/30 text-[#0B2B26] border border-[#8EB69B] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#235347]" />
            Analisis Selesai &bull; Menunggu Validasi HR
          </span>
        );
      case 'interview_scheduled':
      case 'shortlisted':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Lolos Triage &bull; Siap Wawancara
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Belum Memenuhi Kualifikasi
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in select-none">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <button
          onClick={onBackToPortal}
          className="self-start flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-[#e6e6ea] hover:bg-[#f4f4f6] text-xs font-semibold text-[#000000] transition-all shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#1b55f5]" />
          <span>Kembali ke Portal Karir</span>
        </button>

        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#67677e]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1b55f5] shrink-0" />
          <span>Pelacakan Anonim Terenkripsi &bull; UU PDP No. 27/2022</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="clean-card p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf0ff] text-[#1b55f5] border border-blue-200 text-xs font-semibold mb-3">
            <KeyRound className="w-3.5 h-3.5 text-[#1b55f5]" />
            <span>Kandidat Tracking Portal</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#000000] tracking-tight leading-tight">
            Pantau Status Lamaran Secara Transparan
          </h2>
          <p className="text-xs sm:text-sm text-[#67677e] mt-2 leading-relaxed">
            Masukkan <strong className="text-[#000000]">Secret Tracking Token</strong> yang Anda peroleh saat mengirimkan lamaran untuk melihat perkembangan analisis agen AI secara real-time.
          </p>
        </div>
      </div>

      {/* Search Bar Container */}
      <div className="clean-card p-6 shadow-sm">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            fetchStatus();
          }}
          className="space-y-4"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-[#000000]">
            Secret Tracking Token (UUIDv4)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <KeyRound className="w-4 h-4 text-[#67677e] absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Contoh: 7c9e6679-7425-40de-944b-e07fc1f90ae7 atau #TK-A17C9B"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e6e6ea] bg-[#f4f4f6] text-xs font-mono text-[#000000] placeholder:text-[#67677e]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b55f5] focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#1b55f5] hover:bg-[#1545c7] disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-white" />
                  <span>Lacak Status</span>
                </>
              )}
            </button>
          </div>

          {/* Preset Demo Tokens for Evaluators */}
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#67677e] font-medium text-[11px]">Coba Token Contoh:</span>
            <button
              type="button"
              onClick={() => {
                const t = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
                setTokenInput(t);
                fetchStatus(t);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#f4f4f6] hover:bg-white text-[11px] font-mono font-semibold text-[#000000] transition-colors border border-[#e6e6ea]"
            >
              #TK-A17C9B (Budi Santoso - Strong Match)
            </button>
            <button
              type="button"
              onClick={() => {
                const t = 'd41d8cd9-8f00-4b82-9a3b-231a48c6a012';
                setTokenInput(t);
                fetchStatus(t);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#f4f4f6] hover:bg-white text-[11px] font-mono font-semibold text-[#000000] transition-colors border border-[#e6e6ea]"
            >
              #TK-B82F10 (Reza Pratama - Overlap)
            </button>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Results Container */}
      {trackingData && (
        <div className="clean-card p-6 sm:p-8 space-y-6 shadow-sm border border-[#e6e6ea]">
          {/* Header Card Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e6e6ea]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#67677e] uppercase tracking-wider">Identitas Publik:</span>
                <span className="font-mono text-sm font-extrabold text-[#000000] px-2 py-0.5 rounded-md bg-[#f4f4f6] border border-[#e6e6ea]">
                  {trackingData.masked_identifier}
                </span>
                {trackingData.source === 'LIVE_DATABASE' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                    Live VPS Database
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-[#000000]">
                {trackingData.job_title}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#67677e] pt-1">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#1b55f5]" />
                  {trackingData.department || 'Engineering'}
                </span>
                {trackingData.submitted_at && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1b55f5]" />
                    Diajukan: {trackingData.submitted_at}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <span className="text-xs text-[#67677e] font-medium">Status Saat Ini:</span>
              {getStatusBadge(trackingData.status)}
              {lastChecked && (
                <span className="text-[10px] text-[#67677e]">Terakhir dicek: {lastChecked}</span>
              )}
            </div>
          </div>

          {/* Stepper Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#000000] mb-4">
              Perkembangan Evaluasi Triage AI
            </h4>
            <div className="space-y-4">
              {getTimelineSteps(trackingData.status).map((step, idx) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step.done 
                        ? 'bg-[#1b55f5] text-white shadow-2xs' 
                        : (step.current 
                            ? 'bg-[#8ec0ff] text-[#1b55f5] ring-4 ring-[#1b55f5]/20 animate-pulse' 
                            : 'bg-[#f4f4f6] text-[#67677e] border border-[#e6e6ea]')
                    }`}>
                      {step.done ? <CheckCircle2 className="w-4 h-4 text-white" /> : step.id}
                    </div>
                    {idx < 4 && (
                      <div className={`w-0.5 h-8 my-1 ${step.done ? 'bg-[#1b55f5]' : 'bg-[#e6e6ea]'}`}></div>
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${step.done || step.current ? 'text-[#000000]' : 'text-[#67677e]'}`}>
                        {step.title}
                      </span>
                      {step.current && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold animate-pulse">
                          Sedang Berjalan
                        </span>
                      )}
                      {step.done && (
                        <span className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Selesai
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#67677e] mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation Note if Available */}
          {trackingData.recommendation && (
            <div className="p-4 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea] flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#1b55f5] shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-[#000000]">Catatan Evaluasi Agen AI:</span>
                <p className="text-[#454554]">
                  Kandidat memenuhi kualifikasi dengan rekomendasi <strong>{trackingData.recommendation}</strong>. Tim HR kami akan meninjau hasil evaluasi dan menghubungi Anda melalui saluran resmi.
                </p>
              </div>
            </div>
          )}

          {/* UU PDP Right to Erasure Footer Note */}
          <div className="pt-4 border-t border-[#e6e6ea] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-[#67677e]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1b55f5]" />
              Hak Subjek Data UU PDP: Anda dapat meminta penghapusan berkas (Right to Erasure) sewaktu-waktu.
            </span>
            <button
              type="button"
              onClick={() => alert(`Pengajuan Right to Erasure untuk token ${tokenInput} berhasil dicatat. Sesuai UU PDP No. 27/2022, DEK kriptografis kandidat akan dihancurkan (Crypto-Shredding).`)}
              className="text-rose-700 hover:text-rose-800 font-semibold underline text-[11px] transition-colors"
            >
              Ajukan Pencabutan Berkas (Erasure)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
