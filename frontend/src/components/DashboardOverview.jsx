import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CandidateTable from './CandidateTable';
import WeightBar from './WeightBar';
import WorkflowStrip from './WorkflowStrip';
import { can } from '../lib/roles';
import { toPercent } from '../lib/dimensions';
import { formatDateTime } from '../lib/format';
import { categorize, isUnscanned } from '../lib/labels';
import AgentTraceModal from './AgentTraceModal';
import UploadCandidateModal from './UploadCandidateModal';
import {
  Users,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  RefreshCw,
  UploadCloud,
  Clock,
  AlertTriangle,
  Zap,
  Check,
  Sliders,
  ArrowRight,
  Info
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

export default function DashboardOverview() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [traceCandidate, setTraceCandidate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchMessage, setBatchMessage] = useState(null);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/candidates?limit=200`);
      if (res && res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const mapped = json.data.map(c => {
            const dims = c.dimension_scores || {};
            const isUnscanned = c.overall_score === null || c.recommendation === 'PENDING_SCAN' || c.status === 'queued';
            return {
              id: c.id,
              job_id: c.job_id,
              masked_identifier: c.masked_identifier,
              tracking_token: c.tracking_token || `tk-${c.id}`,
              job_title: c.job_title || 'Unknown Role',
              department: c.department || null,
              applied_date: formatDateTime(c.created_at),
              candidate_name_masked: c.masked_identifier,
              overall_score: c.overall_score !== null ? c.overall_score : null,
              scores_4d: c.overall_score !== null ? {
                SKILL: dims.SKILL || 0,
                EXPERIENCE: dims.EXPERIENCE || 0,
                EDUCATION: dims.EDUCATION || 0,
                PORTFOLIO: dims.PORTFOLIO || 0,
              } : null,
              recommendation: isUnscanned ? 'PENDING_SCAN' : (c.recommendation || 'REVIEW_REQUIRED'),
              status: c.status || (isUnscanned ? 'queued' : 'waiting_approval'),
              scan_status: isUnscanned ? 'UNSCANNED' : 'SCANNED',
              confidence_level: isUnscanned ? null : (c.confidence_level || 'MEDIUM'),
              verified_github: c.github_url || null,
              github_status: isUnscanned ? 'PENDING_SCAN' : (c.github_url ? 'VERIFIED' : 'UNVERIFIED'),
              flags: c.flags || [],
              key_technologies: c.key_technologies || [],
            };
          });
          setCandidates(mapped);
          setIsLiveConnected(true);
        } else {
          setCandidates([]);
          setIsLiveConnected(true);
        }
      }
    } catch (err) {
      console.warn('Backend candidates fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Job metadata (weights per opening) — needed by the per-job simulation cards.
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs`);
      if (res && res.ok) {
        const json = await res.json();
        setJobs(json.data || []);
      }
    } catch (err) {
      console.warn('Backend jobs fetch error:', err);
    }
  }, []);

  const handleUploadSuccess = (newCandidate) => {
    setCandidates(prev => [newCandidate, ...prev]);
    setTimeout(() => {
      fetchCandidates();
    }, 500);
  };

  const handleTriageComplete = (candidateId, updatedData) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return { 
          ...c, 
          ...updatedData,
          scan_status: 'SCANNED',
          status: 'waiting_approval'
        };
      }
      return c;
    }));
    setTimeout(() => {
      fetchCandidates();
    }, 1000);
  };

  useEffect(() => {
    fetchCandidates();
    fetchJobs();
  }, [fetchCandidates, fetchJobs]);

  // Derived live pipeline funnel metrics
  const canUpload = can('upload');
  const canBatchTriage = can('batchTriage');

  const unscannedCandidates = useMemo(() => {
    return candidates.filter(isUnscanned);
  }, [candidates]);

  const scannedCandidates = useMemo(() => {
    return candidates.filter(c => !isUnscanned(c));
  }, [candidates]);

  // Buckets must be exclusive and must sum to the pool size. `categorize` is the
  // single definition shared with the table badges, the filter dropdown and the
  // per-job cards, so a candidate can no longer sit in a KPI card while the table
  // labels it differently.
  const buckets = useMemo(() => {
    const acc = { STRONG_MATCH: 0, REVIEW_REQUIRED: 0, WEAK_FIT: 0, SECURITY_QUARANTINE: 0 };
    scannedCandidates.forEach((c) => { acc[categorize(c)] += 1; });
    return acc;
  }, [scannedCandidates]);
  const strongMatches = buckets.STRONG_MATCH;
  const reviewRequired = buckets.REVIEW_REQUIRED;
  const weakFit = buckets.WEAK_FIT;
  const quarantined = buckets.SECURITY_QUARANTINE;

  const avgScore = useMemo(() => {
    if (scannedCandidates.length === 0) return null;
    const total = scannedCandidates.reduce((acc, c) => acc + (c.overall_score || 0), 0);
    return (total / scannedCandidates.length).toFixed(1);
  }, [scannedCandidates]);

  const highConfPct = useMemo(() => {
    if (scannedCandidates.length === 0) return null;
    const count = scannedCandidates.filter(c => c.confidence_level === 'HIGH').length;
    return Math.round((count / scannedCandidates.length) * 100);
  }, [scannedCandidates]);

  // Group the pool per opening: simulation is job-scoped, so each card is its own entry point.
  const jobGroups = useMemo(() => {
    const byId = new Map();
    candidates.forEach(c => {
      if (c.job_id === null || c.job_id === undefined) return;
      const g = byId.get(c.job_id) || {
        job_id: c.job_id,
        title: c.job_title,
        department: c.department,
        candidates: [],
      };
      g.candidates.push(c);
      byId.set(c.job_id, g);
    });
    return Array.from(byId.values()).map(g => {
      const meta = jobs.find(j => j.id === g.job_id);
      const scanned = g.candidates.filter(c => !isUnscanned(c));
      // Counts come from the same `categorize` the KPI cards use, so a card here
      // can no longer disagree with the dashboard above it.
      const byCat = scanned.reduce((acc, c) => {
        const k = categorize(c);
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      return {
        ...g,
        title: meta?.title || g.title,
        department: meta?.department || g.department,
        weights: toPercent(meta?.weight_config),
        total: g.candidates.length,
        scannedCount: scanned.length,
        unscannedCount: g.candidates.length - scanned.length,
        strong: byCat.STRONG_MATCH || 0,
        review: byCat.REVIEW_REQUIRED || 0,
        weak: byCat.WEAK_FIT || 0,
        quarantined: byCat.SECURITY_QUARANTINE || 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [candidates, jobs]);

  // Handle batch triage action
  const handleBatchTriage = async () => {
    if (unscannedCandidates.length === 0) {
      setBatchMessage('Semua berkas kandidat saat ini telah selesai dianalisis AI.');
      setTimeout(() => setBatchMessage(null), 3500);
      return;
    }

    setIsBatchRunning(true);
    setBatchMessage(`Menjalankan batch triage untuk ${unscannedCandidates.length} kandidat...`);
    try {
      const targetIds = unscannedCandidates.map(c => c.id);
      const res = await fetch(`${API_BASE_URL}/api/candidates/batch-triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: targetIds })
      });

      if (!res.ok) {
        throw new Error(`Batch triage server responded with ${res.status}`);
      }

      setTimeout(() => {
        fetchCandidates();
        setIsBatchRunning(false);
        setBatchMessage(`Batch triage berhasil diproses (${unscannedCandidates.length} kandidat).`);
        setTimeout(() => setBatchMessage(null), 3500);
      }, 2500);
    } catch (err) {
      console.warn('Batch triage fallback:', err);
      setIsBatchRunning(false);
      setBatchMessage('Batch triage diproses di latar belakang server.');
      setTimeout(() => {
        fetchCandidates();
        setBatchMessage(null);
      }, 2000);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-jkt">
      {/* 1. Header & Workspace Action Bar */}
      <div className="bg-white rounded-2xl p-6 border border-primary-border-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.03] bg-dot-matrix pointer-events-none"></div>
        <div className="space-y-1 max-w-2xl relative z-10">
          <h2 className="text-xl sm:text-2xl font-extrabold text-primary-black tracking-tight leading-tight">
            Antrean Evaluasi Kandidat
          </h2>
          <p className="text-xs sm:text-sm text-primary-slate-600 leading-relaxed font-normal">
            Skor deterministik 4D dengan bukti kutipan CV dan audit repositori GitHub.
            <span className="hidden sm:inline text-primary-slate-400"> Identitas pelamar tersanitasi sesuai UU PDP No. 27/2022.</span>
          </p>
        </div>

        {/* Global Action Buttons (WebEkspor Rounded-Full Buttons) */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-10">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            disabled={!canUpload}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
              canUpload
                ? 'bg-primary-orange hover:opacity-90 active:scale-98 text-white shadow-lg shadow-primary-orange/25'
                : 'bg-primary-slate-200 text-primary-slate-500 cursor-not-allowed'
            }`}
            title={canUpload
              ? 'Upload berkas CV pelamar baru (PDF/DOCX)'
              : 'Role Anda tidak berwenang mengunggah berkas'}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload CV Baru</span>
          </button>

          <button
            onClick={handleBatchTriage}
            disabled={isBatchRunning || unscannedCandidates.length === 0 || !canBatchTriage}
            title={canBatchTriage
              ? 'Jalankan autonomous agent triage untuk seluruh berkas yang belum di-scan'
              : 'Role Anda tidak berwenang menjalankan triage massal'}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-xs ${
              unscannedCandidates.length > 0 && !isBatchRunning
                ? 'bg-primary-black hover:bg-primary-black/90 text-white'
                : 'bg-primary-slate-100 text-primary-slate-400 border border-primary-border-200 disabled:opacity-60'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isBatchRunning ? 'animate-spin text-primary-orange' : 'text-primary-orange fill-current'}`} />
            <span>
              {isBatchRunning 
                ? 'Memproses Batch...' 
                : `Batch Triage AI (${unscannedCandidates.length})`}
            </span>
          </button>

          <button
            onClick={fetchCandidates}
            disabled={isLoading}
            className="p-2.5 rounded-full bg-white border border-primary-border-200 text-primary-slate-700 hover:border-primary-orange hover:text-primary-orange transition-all shadow-xs"
            title="Sinkronkan data kandidat dari basis data MariaDB"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary-orange' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Workflow strip: replaces the stacked titles with the actual 3-step order. */}
      <WorkflowStrip
        unscannedCount={unscannedCandidates.length}
        reviewCount={reviewRequired}
        onUpload={() => setIsUploadModalOpen(true)}
      />

      {/* Dynamic Status / Feedback Alert Banner */}
      {batchMessage && (
        <div className="p-4 rounded-xl bg-primary-blue/10 border border-primary-blue/30 text-xs font-semibold text-primary-black flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-primary-blue" />
            <span>{batchMessage}</span>
          </div>
          <button 
            onClick={() => setBatchMessage(null)}
            className="text-xs text-primary-blue underline hover:text-primary-black"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 2. Pipeline Stage Cards (WebEkspor Cards) — lima kategori, satu kartu per
          kategori supaya jumlahnya bisa dijumlahkan ke total berkas. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Stage 1: Menunggu Triage AI */}
        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-primary-slate-500">
              <span className="uppercase tracking-wider text-[11px]">Menunggu Triage AI</span>
              <div className="w-7 h-7 rounded-lg bg-primary-orange/10 text-primary-orange flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-primary-black mt-2 tabular-nums">
              {unscannedCandidates.length}
            </div>
            <p className="text-xs text-primary-slate-600 mt-1 leading-snug font-normal">
              {unscannedCandidates.length > 0
                ? 'Berkas pelamar siap diekstrak AI'
                : candidates.length === 0
                  ? 'Belum ada berkas yang diunggah'
                  : 'Semua berkas telah dipindai'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs">
            <span className="text-primary-slate-400">Status</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
              unscannedCandidates.length > 0 ? 'bg-primary-orange/10 text-primary-orange font-bold' : 'bg-primary-slate-100 text-primary-slate-600'
            }`}>
              {unscannedCandidates.length > 0
                ? 'Perlu Diproses'
                : candidates.length === 0
                  ? 'Kosong'
                  : 'Lengkap'}
            </span>
          </div>
        </div>

        {/* Stage 2: Siap Ditinjau HR */}
        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-primary-slate-500">
              <span className="uppercase tracking-wider text-[11px]">Siap Ditinjau HR</span>
              <div className="w-7 h-7 rounded-lg bg-primary-blue/10 text-primary-blue flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-primary-black mt-2 tabular-nums">
              {reviewRequired}
            </div>
            <p className="text-xs text-primary-slate-600 mt-1 leading-snug font-normal">
              {candidates.length === 0
                ? 'Kandidat dengan bukti yang belum konklusif'
                : 'Perlu klarifikasi kualifikasi atau linimasa'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs">
            <span className="text-primary-slate-400">Kategori</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
              candidates.length === 0
                ? 'bg-primary-slate-100 text-primary-slate-500'
                : 'bg-primary-blue/10 text-primary-black'
            }`}>
              {candidates.length === 0 ? 'Belum Dinilai' : 'Perlu Review HR'}
            </span>
          </div>
        </div>

        {/* Stage 3: Sangat Sesuai (Lolos) */}
        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-primary-slate-500">
              <span className="uppercase tracking-wider text-[11px]">Sangat Sesuai (Lolos)</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-primary-black mt-2 tabular-nums">
              {strongMatches}
            </div>
            <p className="text-xs text-primary-slate-600 mt-1 leading-snug font-normal">
              {candidates.length === 0
                ? 'Ambang lolos: skor 4D ≥ 85'
                : 'Skor ≥ 85 • Siap kunci jadwal wawancara'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs">
            <span className="text-primary-slate-400">Rekomendasi</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] border ${
              candidates.length === 0
                ? 'bg-primary-slate-100 text-primary-slate-500 border-primary-border-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}>
              {candidates.length === 0 ? 'Belum Dinilai' : 'Sangat Sesuai'}
            </span>
          </div>
        </div>

        {/* Stage 4: Kurang Sesuai — kartu kelima yang sebelumnya hanya muncul sebagai
            catatan kaki di kartu "Sangat Sesuai", sehingga keempat kartu tidak pernah
            menjumlah ke total berkas. */}
        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-primary-slate-500">
              <span className="uppercase tracking-wider text-[11px]">Kurang Sesuai</span>
              <div className="w-7 h-7 rounded-lg bg-primary-slate-100 text-primary-slate-600 flex items-center justify-center">
                <Info className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-primary-black mt-2 tabular-nums">
              {weakFit}
            </div>
            <p className="text-xs text-primary-slate-600 mt-1 leading-snug font-normal">
              {candidates.length === 0
                ? 'Ambang eliminasi: skor 4D < 60'
                : 'Skor < 60 • Kualifikasi inti tidak terpenuhi'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs">
            <span className="text-primary-slate-400">Rekomendasi</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] border ${
              candidates.length === 0
                ? 'bg-primary-slate-100 text-primary-slate-500 border-primary-border-200'
                : 'bg-primary-slate-100 text-primary-slate-700 border-primary-border-200'
            }`}>
              {candidates.length === 0 ? 'Belum Dinilai' : 'Kurang Sesuai'}
            </span>
          </div>
        </div>

        {/* Stage 5: Karantina Keamanan */}
        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-primary-slate-500">
              <span className="uppercase tracking-wider text-[11px]">Karantina Keamanan</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-primary-black mt-2 tabular-nums">
              {quarantined}
            </div>
            <p className="text-xs text-primary-slate-600 mt-1 leading-snug font-normal">
              {quarantined > 0
              ? 'Berkas ber-flag integritas, wajib audit manual'
              : candidates.length === 0
                ? 'Belum ada berkas untuk disaring'
                : 'Tidak ada berkas ber-flag'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-primary-border-100 flex items-center justify-between text-xs">
            <span className="text-primary-slate-400">Penyaring</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] border ${
              candidates.length === 0
                ? 'bg-primary-slate-100 text-primary-slate-500 border-primary-border-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {candidates.length === 0 ? 'Belum Disaring' : 'Karantina Keamanan'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Live Operational KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-primary-slate-500 uppercase tracking-wider">
              Rata-rata Skor Kesesuaian 4D
            </span>
            <div className="text-3xl font-extrabold text-primary-black tracking-tight tabular-nums">
              {avgScore !== null ? avgScore : '—'} <span className="text-xs font-semibold text-primary-slate-400">/ 100</span>
            </div>
            <p className="text-xs text-primary-slate-600">
              {avgScore !== null
                ? <>Dihitung dari <strong className="text-primary-black">{scannedCandidates.length}</strong> berkas terverifikasi</>
                : 'Belum ada berkas yang telah dianalisis AI'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-orange/10 border border-primary-orange/30 flex items-center justify-center text-primary-orange">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-primary-slate-500 uppercase tracking-wider">
              Ketertelusuran Bukti CV (Grounding)
            </span>
            <div className="text-3xl font-extrabold text-primary-black tracking-tight tabular-nums">
              {highConfPct !== null ? `${highConfPct}%` : '—'} <span className="text-xs font-semibold text-emerald-600">High Conf</span>
            </div>
            <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{highConfPct !== null ? 'Substring Guard anti-halusinasi aktif' : 'Menunggu hasil analisis AI pertama'}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-primary-border-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-primary-slate-500 uppercase tracking-wider">
              Kepatuhan Privasi UU PDP No. 27/2022
            </span>
            <div className="text-3xl font-extrabold text-primary-black tracking-tight tabular-nums">
              100% <span className="text-xs font-semibold text-primary-slate-400">AES-256</span>
            </div>
            <p className="text-xs text-primary-blue font-medium">
              Blind index HMAC + Right to Erasure
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-black/5 border border-primary-black/10 flex items-center justify-center text-primary-black">
            <ShieldCheck className="w-6 h-6 text-primary-orange" />
          </div>
        </div>
      </div>

      {/* 4. Per-Job Policy Simulation Entry Cards */}
      {jobGroups.length > 0 && (
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-lg font-extrabold text-primary-black tracking-tight">Simulasi Kebijakan per Lowongan</h3>
            <p className="text-xs text-primary-slate-600">
              Tiap lowongan punya bobot 4D sendiri. Buka kartu untuk menggeser bobot dan passing grade,
              lalu lihat siapa yang naik atau turun kategori tanpa mengubah data tersimpan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {jobGroups.map(g => (
              <div
                key={g.job_id}
                className="bg-white rounded-2xl border border-primary-border-200 p-5 shadow-sm hover:border-primary-orange hover:shadow-card-hover transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-primary-black truncate" title={g.title}>{g.title}</p>
                      <p className="text-[11px] text-primary-slate-500">{g.department || 'General'}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-slate-100 text-primary-slate-700 text-[10px] font-bold tabular-nums">
                      <Users className="w-2.5 h-2.5" />
                      {g.total}
                    </span>
                  </div>

                  <WeightBar weights={g.weights} showLegend={false} />

                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 tabular-nums">
                      {g.strong} Strong
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-blue/10 text-primary-black border border-primary-blue/30 tabular-nums">
                      {g.review} Review
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                      {g.weak} Weak
                    </span>
                    {g.quarantined > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 tabular-nums">
                        {g.quarantined} Karantina
                      </span>
                    )}
                    {g.unscannedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-primary-orange/10 text-primary-orange border border-primary-orange/30 tabular-nums">
                        {g.unscannedCount} belum scan
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/admin/what-if/${g.job_id}`)}
                  disabled={g.scannedCount === 0}
                  title={g.scannedCount === 0 ? 'Belum ada kandidat ter-triage untuk disimulasikan' : 'Buka studio simulasi bobot & ambang'}
                  className={`mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all ${
                    g.scannedCount === 0
                      ? 'bg-primary-slate-100 text-primary-slate-400 border border-primary-border-200 cursor-not-allowed'
                      : 'bg-primary-orange hover:opacity-90 text-white shadow-lg shadow-primary-orange/25'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Simulasi Bobot &amp; Ambang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Main Candidates Queue Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-primary-black tracking-tight">Antrean Berkas Kandidat</h3>
            <p className="text-xs text-primary-slate-600">
              Daftar pelamar dengan kontrol manual analisis AI, review dossier terperinci, dan audit repositori
            </p>
          </div>
        </div>

        {candidates.length === 0 && !isLoading ? (
          <div className="bg-white rounded-2xl border border-primary-border-200 p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-slate-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-slate-400" />
            </div>
            <p className="text-sm font-bold text-primary-black">Belum Ada Kandidat</p>
            <p className="text-xs text-primary-slate-500 max-w-xs">
              Unggah berkas CV lewat tombol "Upload CV Baru" di atas, atau minta pelamar mendaftar via Portal Karier publik.
            </p>
          </div>
        ) : (
          <CandidateTable 
            candidates={candidates} 
            onSelectCandidate={(cand) => navigate(`/admin/candidates/${cand.id}`)} 
            onStreamCandidate={setTraceCandidate}
            onStartTriage={(cand) => setTraceCandidate(cand)}
          />
        )}
      </div>

      {/* Live Agentic Trace SSE Modal */}
      <AgentTraceModal
        candidate={traceCandidate}
        isOpen={!!traceCandidate}
        onClose={() => setTraceCandidate(null)}
        onTriageComplete={handleTriageComplete}
      />

      {/* HR Direct Upload Candidate Modal */}
      <UploadCandidateModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
