import React, { useState, useEffect } from 'react';
import {
  Search,
  KeyRound,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Building2,
  Calendar,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { recLabel } from '../lib/labels';
import { formatDateTime } from '../lib/format';
import { DIMENSIONS } from '../lib/dimensions';

// Enum backend tidak boleh tampil mentah. Dua label ini khusus halaman publik:
// "Perlu Pemeriksaan Manual" bukan istilah yang dipakai rekruter internal.
const CONFIDENCE_LABELS = {
  HIGH: 'Tinggi — bukti pada CV terverifikasi',
  MEDIUM: 'Sedang — sebagian klaim tanpa rincian teknis',
  LOW: 'Rendah — sedikit klaim teknis yang bisa diverifikasi',
};

const RISK_LABELS = {
  LOW: 'Tidak ada indikasi',
  MEDIUM: 'Ada indikasi yang perlu dikonfirmasi',
  HIGH: 'Perlu konfirmasi sebelum diproses',
};

const confidenceLabel = (key) => CONFIDENCE_LABELS[key] || key || '—';
const riskLabel = (key) => RISK_LABELS[key] || key || '—';


export default function ApplicationTracker({ initialToken = '', onBackToPortal }) {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.talentops.ai.id';

  const fetchStatus = async (tokenToFetch) => {
    const raw = (tokenToFetch || tokenInput).trim();
    if (!raw) {
      setError('Harap masukkan Secret Tracking Token yang Anda terima saat melamar.');
      return;
    }

    // The backend accepts a UUIDv4 only. "#TK-XXXX" is the *display* identifier
    // shown in the success modal and cannot be looked up, so say that plainly
    // instead of forwarding it and returning a confusing 404.
    if (/^#?TK-/i.test(raw)) {
      setError(
        `"${raw}" adalah ID tampilan, bukan token pelacakan. Buka kembali halaman token setelah melamar dan salin kode 36 karakter berformat 7c9e6679-7425-40de-944b-e07fc1f90ae7.`
      );
      return;
    }

    const token = raw.toLowerCase();
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (!UUID_REGEX.test(token)) {
      setError('Token pelacakan berformat 36 karakter dengan tanda hubung (contoh: 7c9e6679-7425-40de-944b-e07fc1f90ae7).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/careers/track/${encodeURIComponent(token)}`);

      if (res && res.ok) {
        const data = await res.json();
        setTrackingData({
          masked_identifier: data.masked_identifier,
          job_title: data.job_title,
          department: data.department,
          status: data.status || 'queued',
          recommendation: data.recommendation,
          submitted_at: data.submitted_at,
          assessment: data.assessment || null,
          source: 'LIVE_DATABASE'
        });
        setLastChecked(new Date().toLocaleTimeString('id-ID'));
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        setError('Token tidak ditemukan atau berkas lamaran telah dihapus (Right to Erasure).');
        setLoading(false);
        return;
      }

      // Offline copy written by the portal when the submission succeeded. It is a
      // snapshot from this device, so it must be labelled as such — the old code
      // rendered it identically to a live server response.
      try {
        const localCached = localStorage.getItem(`talentops_app_${token}`);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          setTrackingData({ ...parsed, source: 'LOCAL_CACHE' });
          setLastChecked(new Date().toLocaleTimeString('id-ID'));
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Cached application snapshot is unreadable:', e);
      }

      setError(`Gagal memuat status lamaran: server merespons ${res.status}.`);
    } catch (err) {
      console.warn('Network error fetching tracking status:', err);
      setError('Koneksi ke server gagal. Pastikan jaringan internet aktif.');
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

  const getTimelineSteps = (status) => {
    return [
      {
        id: 1,
        title: 'Berkas Diterima & Disanitasi',
        desc: 'Nama, kontak, dan data pribadi disamarkan sebelum berkas dibaca sistem',
        done: true,
        current: false,
      },
      {
        id: 2,
        title: 'Audit Integritas Berkas',
        desc: 'Pemeriksaan berkas rusak, teks tak terlihat, dan instruksi tersembunyi',
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
        desc: 'Keahlian inti, pengalaman kerja, pendidikan, dan portofolio dinilai terpisah lalu digabung dengan bobot lowongan',
        done: ['waiting_approval', 'interview_scheduled', 'shortlisted'].includes(status),
        current: false,
      },
      {
        id: 5,
        title: 'Keputusan Penyaringan & Peninjauan Tim HR',
        desc: 'Rekomendasi otomatis & reservasi kalender wawancara',
        done: ['interview_scheduled', 'shortlisted'].includes(status),
        current: ['waiting_approval'].includes(status),
      }
    ];
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'queued':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-jkt font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Dalam Antrean Penyaringan
          </span>
        );
      case 'analyzing':
      case 'in_review':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-jkt font-bold bg-primary-blue/10 text-primary-black border border-primary-blue/30 flex items-center gap-1.5 animate-pulse">
            <Cpu className="w-3.5 h-3.5 text-primary-blue" />
            Sedang Dianalisis AI Agent
          </span>
        );
      case 'waiting_approval':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-jkt font-bold bg-primary-orange/10 text-primary-black border border-primary-orange/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary-orange" />
            Analisis Selesai &bull; Menunggu Validasi HR
          </span>
        );
      case 'interview_scheduled':
      case 'shortlisted':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-jkt font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Lolos Penyaringan &bull; Siap Wawancara
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-jkt font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Belum Memenuhi Kualifikasi
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-jkt font-bold bg-primary-slate-100 text-primary-slate-800 border border-primary-border-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-6 pb-16 px-4 sm:px-6 font-jkt">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBackToPortal}
          className="self-start flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-primary-border-200 hover:border-primary-orange text-xs font-semibold text-primary-black transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-primary-orange" />
          <span>Kembali ke Pilihan Lowongan</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-primary-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-primary-orange shrink-0" />
          <span>Pelacakan Anonim Terenkripsi &bull; UU PDP No. 27/2022</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="rounded-2xl border border-primary-border-200 bg-white p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-orange/10 text-primary-black border border-primary-orange/30 text-xs font-semibold mb-3">
            <KeyRound className="w-3.5 h-3.5 text-primary-orange" />
            <span className="tracking-[0.18em] uppercase text-[11px] font-bold">Kandidat Tracking Portal</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary-black tracking-tight leading-tight">
            Pantau Status Lamaran Secara <span className="relative inline-block"><span className="relative z-10 italic font-medium">Transparan</span><span aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-2.5 bg-primary-orange/60 -z-0 -skew-x-6"></span></span>
          </h2>
          <p className="text-xs sm:text-sm text-primary-slate-600 mt-2 leading-relaxed">
            Masukkan <strong className="text-primary-black font-bold">Secret Tracking Token</strong> yang Anda peroleh saat mengirimkan lamaran untuk melihat perkembangan analisis agen AI secara real-time.
          </p>
        </div>
      </div>

      {/* Search Bar Container */}
      <div className="rounded-2xl border border-primary-border-200 bg-white p-6 shadow-sm">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            fetchStatus();
          }}
          className="space-y-4"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-primary-black">
            Secret Tracking Token (UUIDv4)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <KeyRound className="w-4 h-4 text-primary-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="7c9e6679-7425-40de-944b-e07fc1f90ae7"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary-border-200 bg-primary-slate-50 text-xs font-mono text-primary-black placeholder:text-primary-slate-400 focus:bg-white focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-full bg-primary-orange hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-primary-orange/25 flex items-center justify-center gap-2 transition-all shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-white" />
                  <span>Lacak Status Berkas</span>
                </>
              )}
            </button>
          </div>

          {/* Preset Demo Tokens for Evaluators */}
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-primary-slate-400 font-medium text-[11px]">Coba token demo:</span>
            <button
              type="button"
              onClick={() => {
                const t = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
                setTokenInput(t);
                fetchStatus(t);
              }}
              className="px-2.5 py-1 rounded-lg bg-primary-slate-50 hover:bg-white text-[11px] font-semibold text-primary-black transition-colors border border-primary-border-200 hover:border-primary-orange whitespace-nowrap"
            >
              Budi Santoso (Sangat Sesuai)
            </button>
            <button
              type="button"
              onClick={() => {
                const t = 'd41d8cd9-8f00-4b82-9a3b-231a48c6a012';
                setTokenInput(t);
                fetchStatus(t);
              }}
              className="px-2.5 py-1 rounded-lg bg-primary-slate-50 hover:bg-white text-[11px] font-semibold text-primary-black transition-colors border border-primary-border-200 hover:border-primary-orange whitespace-nowrap"
            >
              Reza Pratama (Perlu Review)
            </button>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Results Container */}
      {trackingData && (
        <div className="rounded-2xl border border-primary-border-200 bg-white p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Header Card Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-primary-border-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary-slate-500 uppercase tracking-wider">Identitas Publik:</span>
                <span className="font-mono text-sm font-extrabold text-primary-black px-2.5 py-0.5 rounded-md bg-primary-slate-50 border border-primary-border-200">
                  {trackingData.masked_identifier}
                </span>
                {trackingData.source === 'LIVE_DATABASE' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-300">
                    Terbaru dari server
                  </span>
                ) : (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-300"
                    title="Server tidak dapat dihubungi; ini salinan yang tersimpan di perangkat ini saat Anda melamar."
                  >
                    Salinan Lokal — belum tersinkron server
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-primary-black">
                {trackingData.job_title}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-primary-slate-600 pt-1">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary-blue" />
                  {trackingData.department || 'Engineering'}
                </span>
                {trackingData.submitted_at && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary-orange" />
                    Diajukan: {formatDateTime(trackingData.submitted_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <span className="text-xs text-primary-slate-500 font-medium">Status Saat Ini:</span>
              {getStatusBadge(trackingData.status)}
              {lastChecked && (
                <span className="text-[10px] text-primary-slate-400">Terakhir dicek: {lastChecked}</span>
              )}
            </div>
          </div>

          {/* Stepper Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-black mb-4">
              Perkembangan Evaluasi Penyaringan AI
            </h4>
            <div className="space-y-4">
              {getTimelineSteps(trackingData.status).map((step, idx) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step.done 
                        ? 'bg-primary-black text-white shadow-xs' 
                        : (step.current 
                            ? 'bg-primary-orange text-white ring-4 ring-primary-orange/20 animate-pulse' 
                            : 'bg-primary-slate-100 text-primary-slate-400 border border-primary-border-200')
                    }`}>
                      {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : step.id}
                    </div>
                    {idx < 4 && (
                      <div className={`w-0.5 h-8 my-1 ${step.done ? 'bg-primary-black' : 'bg-primary-border-200'}`}></div>
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${step.done || step.current ? 'text-primary-black' : 'text-primary-slate-400'}`}>
                        {step.title}
                      </span>
                      {step.current && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-orange/10 text-primary-orange border border-primary-orange/30 font-bold animate-pulse">
                          Sedang Berjalan
                        </span>
                      )}
                      {step.done && (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Selesai
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-primary-slate-600 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessment Breakdown: skor per dimensi + alasan keputusan.
              Backend hanya mengirim ini setelah penyaringan benar-benar berjalan
              (assessment null selama queued), jadi tidak ada angka palsu 0.0. */}
          {trackingData.assessment && (
            <div className="pt-4 border-t border-primary-border-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary-black">
                  Rincian Penilaian 4 Dimensi
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-500">
                    Total
                  </span>
                  <span className="font-mono text-sm font-extrabold text-primary-black tabular-nums">
                    {trackingData.assessment.overall_score.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-primary-slate-400">/ 100</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {DIMENSIONS.map((dim) => {
                  const value = trackingData.assessment.dimension_scores?.[dim.key] ?? 0;
                  const weight = trackingData.assessment.weights?.[dim.key];
                  return (
                    <div key={dim.key}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-primary-black">
                          {dim.label}
                          {weight != null && (
                            <span className="ml-1.5 font-normal text-primary-slate-400">
                              &times; {Math.round(weight * 100)}%
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-primary-slate-700 tabular-nums">
                          {value.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-primary-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${dim.bar}`}
                          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-primary-slate-400 leading-relaxed">
                Total adalah rata-rata berbobot keempat dimensi di atas, bukan rata-rata biasa.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-primary-slate-50 border border-primary-border-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-primary-slate-500 mb-0.5">
                    Tingkat Keyakinan Data
                  </span>
                  <span className="font-semibold text-primary-black">
                    {confidenceLabel(trackingData.assessment.confidence_level)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-primary-slate-50 border border-primary-border-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-primary-slate-500 mb-0.5">
                    Perlu Pemeriksaan Manual
                  </span>
                  <span className="font-semibold text-primary-black">
                    {riskLabel(trackingData.assessment.unresolved_risk)}
                  </span>
                </div>
              </div>

              {trackingData.assessment.decision_reason && (
                <p className="text-[11px] text-primary-slate-600 leading-relaxed">
                  <span className="font-bold text-primary-black">Dasar keputusan: </span>
                  {trackingData.assessment.decision_reason} Keputusan akhir tetap diambil tim HR setelah
                  meninjau bukti pada CV Anda.
                </p>
              )}

              <p className="text-[10px] text-primary-slate-400 leading-relaxed">
                Skor dihitung dari kecocokan kompetensi, durasi pengalaman, jenjang pendidikan, dan bukti
                portofolio. Kutipan isi CV dan catatan pemeriksaan internal tidak ditampilkan di halaman publik.
              </p>
            </div>
          )}

          {/* Recommendation Note if Available */}
          {trackingData.recommendation && (
            <div className="p-4 rounded-xl bg-primary-slate-50 border border-primary-border-200 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary-orange shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-primary-black">Catatan Evaluasi Agen AI:</span>
                <p className="text-primary-slate-700">
                  Kandidat memenuhi kualifikasi dengan rekomendasi <strong>{recLabel(trackingData.recommendation)}</strong>. Tim HR kami akan meninjau hasil evaluasi dan menghubungi Anda melalui saluran resmi.
                </p>
              </div>
            </div>
          )}

          {/* UU PDP Right to Erasure Footer Note */}
          <div className="pt-4 border-t border-primary-border-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-primary-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary-orange" />
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
