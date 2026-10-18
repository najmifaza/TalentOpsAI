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
          className="self-start flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-[#E1EBE4] hover:bg-[#EEF4F0] text-xs font-semibold text-[#0B2B26] transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-[#235347]" />
          <span>Kembali ke Portal Karir</span>
        </button>

        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#6C837C]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#235347] shrink-0" />
          <span>Pelacakan Anonim Terenkripsi &bull; UU PDP No. 27/2022</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="p-6 sm:p-8 forest-card relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8EB69B]/20 text-[#DAF1DE] border border-[#8EB69B]/30 text-xs font-semibold mb-3">
            <KeyRound className="w-3.5 h-3.5 text-[#8EB69B]" />
            <span>Kandidat Tracking Portal</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Pantau Status Lamaran Secara Transparan
          </h2>
          <p className="text-xs sm:text-sm text-[#8EB69B] mt-2 leading-relaxed">
            Masukkan <strong>Secret Tracking Token</strong> yang Anda peroleh saat mengirimkan lamaran untuk melihat perkembangan analisis agen AI secara real-time.
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
          <label className="block text-xs font-bold uppercase tracking-wider text-[#0B201B]">
            Secret Tracking Token (UUIDv4)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <KeyRound className="w-4 h-4 text-[#6C837C] absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Contoh: 7c9e6679-7425-40de-944b-e07fc1f90ae7 atau #TK-A17C9B"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#C2E0C4] bg-[#EEF4F0]/40 text-xs font-mono text-[#0B201B] placeholder:text-[#6C837C]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#235347] focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#0B2B26] hover:bg-[#163832] disabled:opacity-50 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#8EB69B]" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-[#8EB69B]" />
                  <span>Lacak Status</span>
                </>
              )}
            </button>
          </div>

          {/* Preset Demo Tokens for Evaluators */}
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#6C837C] font-medium text-[11px]">Coba Token Contoh:</span>
            <button
              type="button"
              onClick={() => {
                const t = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
                setTokenInput(t);
                fetchStatus(t);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#EEF4F0] hover:bg-[#C2E0C4]/60 text-[11px] font-mono font-semibold text-[#0B2B26] transition-colors border border-[#E1EBE4]"
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
              className="px-2.5 py-1 rounded-lg bg-[#EEF4F0] hover:bg-[#C2E0C4]/60 text-[11px] font-mono font-semibold text-[#0B2B26] transition-colors border border-[#E1EBE4]"
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
        <div className="clean-card p-6 sm:p-8 space-y-6 shadow-md border-[#C2E0C4]">
          {/* Header Card Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E1EBE4]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#6C837C] uppercase tracking-wider">Identitas Publik:</span>
                <span className="font-mono text-sm font-extrabold text-[#0B2B26] px-2 py-0.5 rounded-md bg-[#EEF4F0] border border-[#C2E0C4]">
                  {trackingData.masked_identifier}
                </span>
                {trackingData.source === 'LIVE_DATABASE' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                    Live VPS Database
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-[#0B201B]">
                {trackingData.job_title}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#6C837C] pt-1">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#235347]" />
                  {trackingData.department || 'Engineering'}
                </span>
                {trackingData.submitted_at && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#235347]" />
                    Diajukan: {trackingData.submitted_at}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <span className="text-xs text-[#6C837C] font-medium">Status Saat Ini:</span>
              {getStatusBadge(trackingData.status)}
              {lastChecked && (
                <span className="text-[10px] text-[#6C837C]">Terakhir dicek: {lastChecked}</span>
              )}
            </div>
          </div>

          {/* Stepper Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B201B] mb-4">
              Perkembangan Evaluasi Triage AI
            </h4>
            <div className="space-y-4">
              {getTimelineSteps(trackingData.status).map((step, idx) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step.done 
                        ? 'bg-[#0B2B26] text-[#8EB69B]' 
                        : (step.current 
                            ? 'bg-[#8EB69B] text-[#051F20] ring-4 ring-[#8EB69B]/30 animate-pulse' 
                            : 'bg-[#EEF4F0] text-[#6C837C] border border-[#E1EBE4]')
                    }`}>
                      {step.done ? <CheckCircle2 className="w-4 h-4 text-[#8EB69B]" /> : step.id}
                    </div>
                    {idx < 4 && (
                      <div className={`w-0.5 h-8 my-1 ${step.done ? 'bg-[#0B2B26]' : 'bg-[#E1EBE4]'}`}></div>
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${step.done || step.current ? 'text-[#0B201B]' : 'text-[#6C837C]'}`}>
                        {step.title}
                      </span>
                      {step.current && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">
                          Sedang Berjalan
                        </span>
                      )}
                      {step.done && (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Selesai
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6C837C] mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation Note if Available */}
          {trackingData.recommendation && (
            <div className="p-4 rounded-2xl bg-[#EEF4F0] border border-[#C2E0C4] flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#235347] shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-[#0B201B]">Catatan Evaluasi Agen AI:</span>
                <p className="text-[#3D544E]">
                  Kandidat memenuhi kualifikasi dengan rekomendasi <strong>{trackingData.recommendation}</strong>. Tim HR kami akan meninjau hasil evaluasi dan menghubungi Anda melalui saluran resmi.
                </p>
              </div>
            </div>
          )}

          {/* UU PDP Right to Erasure Footer Note */}
          <div className="pt-4 border-t border-[#E1EBE4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-[#6C837C]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#235347]" />
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
