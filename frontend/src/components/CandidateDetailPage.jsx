import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  GitBranch, 
  Clock, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  Info,
  RefreshCw,
  Mail,
  Phone,
  Eye,
  EyeOff,
  HelpCircle,
  ShieldAlert,
  ExternalLink
} from 'lucide-react';
import { CandidateEvidenceGraph } from './EvidenceGraph';
import { recLabel, statusLabel, confidenceLabel, riskLabel, slotStatusLabel, formatScore } from '../lib/labels';
import { DIMENSIONS } from '../lib/dimensions';
import { can, roleLabel, unmaskBlockedReason } from '../lib/roles';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.talentops.ai.id';

const safeUrl = (u) => {
  if (!u || typeof u !== 'string') return null;
  try {
    const parsed = new URL(u);
    return ['http:', 'https:'].includes(parsed.protocol) ? u : null;
  } catch {
    return null;
  }
};

const ANOMALY_DICTIONARY = {
  CONCURRENT_FULLTIME_OVERLAP: {
    title: 'Tumpang Tindih Pekerjaan Purnawaktu (Concurrent Overlap)',
    severity: 'HIGH',
    defaultDesc: 'Kandidat tercatat memegang lebih dari satu posisi pekerjaan purnawaktu (full-time) secara bersamaan dalam periode waktu yang sama (> 3 bulan).',
    defaultAction: 'Klarifikasi pada sesi wawancara apakah salah satu peran sebenarnya paruh waktu, freelance, atau terjadi komitmen waktu ganda.',
  },
  PROMPT_INJECTION: {
    title: 'Indikasi Manipulasi Teks / Prompt Injection',
    severity: 'HIGH',
    defaultDesc: 'Terdeteksi instruksi manipulatif atau teks tersembunyi (font 0pt/putih) yang mencoba memanipulasi evaluasi kecerdasan buatan.',
    defaultAction: 'Lakukan audit manual pada berkas CV fisik mentah. Batalkan proses jika terbukti memuat manipulasi format.',
  },
  SECURITY_INSPECTION_FAILED: {
    title: 'Karantina Keamanan Berkas (Security Quarantine)',
    severity: 'HIGH',
    defaultDesc: 'Struktur biner atau konten berkas terindikasi abnormal, korup, atau tidak lolos inspeksi keamanan dokumen.',
    defaultAction: 'Minta pelamar mengunggah ulang dokumen dalam format PDF atau DOCX standar.',
  },
  TITLE_INFLATION: {
    title: 'Lonjakan Jabatan Ekstrem (Title Inflation)',
    severity: 'MEDIUM',
    defaultDesc: 'Kenaikan jenjang jabatan terjadi secara instan (< 6 bulan) dari level awal/magang langsung ke level pimpinan/arsitek tanpa masa transisi wajar.',
    defaultAction: 'Uji kedalaman tanggung jawab teknis dan manajerial kandidat melalui studi kasus arsitektur sistem.',
  },
  TITLE_INFLATION_DETECTED: {
    title: 'Lonjakan Jabatan Ekstrem (Title Inflation)',
    severity: 'MEDIUM',
    defaultDesc: 'Kenaikan jenjang jabatan terjadi secara instan (< 6 bulan) dari level awal/magang langsung ke level pimpinan/arsitek tanpa masa transisi wajar.',
    defaultAction: 'Uji kedalaman tanggung jawab teknis dan manajerial kandidat melalui studi kasus arsitektur sistem.',
  },
  CAREER_BREAK_FLAG: {
    title: 'Jeda Riwayat Karier (Career Break)',
    severity: 'LOW',
    defaultDesc: 'Terdeteksi kesenjangan waktu tanpa riwayat kerja aktif lebih dari 12 bulan.',
    defaultAction: 'Tanyakan secara santun aktivitas pengembangan kompetensi, studi lanjutan, atau proyek independen selama masa jeda tersebut.',
  },
};

// Post-commit delivery report for a review decision. Each channel is best-effort
// on the backend, so a `reason` here is the only place a silent failure surfaces.
function DeliveryReport({ notifications }) {
  if (!notifications) return null;

  const rows = [];
  const cal = notifications.calendar;
  if (cal) {
    rows.push({
      key: 'calendar',
      label: 'Jadwal Wawancara (Kalender Mandiri)',
      ok: Boolean(cal.synced),
      detail: cal.synced
        ? `Terkunci di database lokal (Event ID: ${cal.event_id || 'terkonfirmasi'})`
        : `Tidak tersinkron: ${cal.reason || 'alasan tidak dilaporkan'}`,
      exportUrl: cal.export_google_url,
    });
  }
  const email = notifications.email;
  if (email) {
    rows.push({
      key: 'email',
      label: 'Email Pelamar',
      ok: Boolean(email.sent),
      detail: email.sent
        ? `Terkirim via ${email.provider || 'penyedia tidak dilaporkan'}`
        : `Tidak terkirim: ${email.reason || 'alasan tidak dilaporkan'}`,
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="p-3.5 rounded-2xl bg-primary-slate-50 border border-primary-border-200 text-left space-y-2 text-xs">
      <span className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-600 block">
        Status Notifikasi Otomatis
      </span>
      {rows.map((row) => (
        <div key={row.key} className="flex items-start gap-2 py-1 border-b border-primary-border-200 last:border-0">
          {row.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-primary-slate-900">{row.label}</p>
            <p className={`text-[11px] leading-snug break-words ${row.ok ? 'text-primary-slate-700' : 'text-amber-800'}`}>
              {row.detail}
            </p>
            {safeUrl(row.exportUrl) && (
              <a
                href={safeUrl(row.exportUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary-black text-white hover:bg-primary-blue text-[11px] font-bold transition-colors"
              >
                <span>Buka di Google Calendar Pribadi</span>
                <ExternalLink className="w-3 h-3 text-primary-orange" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


export default function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const candidateId = Number(id);

  // Row-level fields (score, technologies, flags) live on the list payload; the
  // dossier payload adds resume text, anomalies, evidence and assessments.
  const [candidate, setCandidate] = useState(null);
  const [isLoadingCandidate, setIsLoadingCandidate] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'graph' | 'cv' | 'schedule'
  const [viewState, setViewState] = useState('dossier'); // 'dossier' | 'scheduled_done' | 'reject_confirm' | 'reject_done'
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [unmaskedIdentity, setUnmaskedIdentity] = useState(null);
  const [unmaskReason, setUnmaskReason] = useState('');
  const [isUnmaskFormOpen, setIsUnmaskFormOpen] = useState(false);
  const [isUnmasking, setIsUnmasking] = useState(false);
  const [unmaskError, setUnmaskError] = useState(null);
  const canUnmask = can('unmask');
  const canReview = can('review');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingResumeFile, setIsLoadingResumeFile] = useState(false);
  const [resumeFileError, setResumeFileError] = useState(null);
  // A failed file fetch belongs to the CV tab; leaving it must clear the error
  // instead of letting it follow the reviewer to every other tab.
  useEffect(() => { setResumeFileError(null); }, [activeTab]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState(null);
  // Decision submission failure. Never render a success receipt off a failed POST.
  const [submitError, setSubmitError] = useState(null);

  // Scheduling states: direct date & time input
  const [interviewDate, setInterviewDate] = useState(() => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    return tmr.toISOString().split('T')[0];
  });
  const [interviewTime, setInterviewTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [interviewAgenda, setInterviewAgenda] = useState('Technical System Architecture & Competency Defense');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedEvent, setBookedEvent] = useState(null);
  // Post-commit side effects reported by POST /{id}/review. Best-effort on the
  // backend, so the UI must show a failure instead of assuming delivery.
  const [notifications, setNotifications] = useState(null);
  const [rejectReason, setRejectReason] = useState('Skor keahlian di bawah threshold kompetensi posisi');
  const messageTimeoutRef = useRef(null);

  const goBack = () => {
    if (window.history.length > 1 && window.location.key !== 'default') navigate(-1);
    else navigate('/admin/dashboard');
  };

  // Reset all state when navigating to another candidate ID to prevent PII leakage
  useEffect(() => {
    setCandidate(null);
    setCandidateDetail(null);
    setUnmaskedIdentity(null);
    setUnmaskReason('');
    setIsUnmaskFormOpen(false);
    setIsUnmasking(false);
    setUnmaskError(null);
    setBookedEvent(null);
    setNotifications(null);
    setSubmitError(null);
    setViewState('dossier');
    setActiveTab('summary');
    setLoadError(null);
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    setInterviewDate(tmr.toISOString().split('T')[0]);
    setInterviewTime('10:00');
    setDurationMinutes(60);
    setInterviewAgenda('Technical System Architecture & Competency Defense');
  }, [candidateId]);

  // Load dossier detail + the matching list row for this candidate
  const loadCandidateDetail = useCallback(async (signal) => {
    if (!candidateId) {
      setIsLoadingCandidate(false);
      setLoadError('ID kandidat tidak valid pada URL.');
      return;
    }
    setIsLoadingDetail(true);
    try {
      const detailPromise = fetch(`${API_BASE_URL}/api/candidates/${candidateId}`, { signal });
      const listPromise = fetch(`${API_BASE_URL}/api/candidates?limit=200`, { signal }).catch(() => null);
      const [detailRes, listRes] = await Promise.all([detailPromise, listPromise]);

      if (!detailRes.ok) {
        setLoadError(
          detailRes.status === 404
            ? 'Kandidat tidak ditemukan atau sudah dihapus.'
            : `Gagal memuat dossier kandidat (${detailRes.status}).`
        );
        return;
      }

      const json = await detailRes.json();
      setCandidateDetail(json);
      setLoadError(null);

      let row = null;
      if (listRes && listRes.ok) {
        const list = await listRes.json().catch(() => ({}));
        row = (list.data || []).find((c) => c.id === candidateId) || null;
      }

      const dossier = json.candidate || {};
      const dims = (row && row.dimension_scores) || dossier.dimension_scores || {};
      if (!row) {
        // Row missing from the list page: derive what the dossier alone can supply.
        row = {
          id: dossier.id ?? candidateId,
          masked_identifier: dossier.masked_identifier,
          status: dossier.status,
          overall_score: dossier.overall_score,
          recommendation: dossier.recommendation,
          github_url: dossier.github_url,
          portfolio_url: dossier.portfolio_url,
          job_title: null,
          scores_4d: dossier.overall_score !== null && dossier.overall_score !== undefined ? {
            SKILL: dims.SKILL || 0,
            EXPERIENCE: dims.EXPERIENCE || 0,
            EDUCATION: dims.EDUCATION || 0,
            PORTFOLIO: dims.PORTFOLIO || 0,
          } : null,
          confidence_level: dossier.confidence_level || null,
          unresolved_risk: dossier.unresolved_risk || null,
          key_technologies: (json.evidence || [])
            .map((e) => e.target_competency)
            .filter((t, i, arr) => t && arr.indexOf(t) === i),
          flags: (json.anomalies || []).map((a) => a.anomaly_type).filter(Boolean),
        };
      } else {
        row = {
          ...row,
          candidate_name_masked: row.masked_identifier,
          verified_github: row.github_url || null,
          scores_4d: row.overall_score !== null && row.overall_score !== undefined ? {
            SKILL: dims.SKILL || 0,
            EXPERIENCE: dims.EXPERIENCE || 0,
            EDUCATION: dims.EDUCATION || 0,
            PORTFOLIO: dims.PORTFOLIO || 0,
          } : null,
          confidence_level: row.confidence_level || null,
          unresolved_risk: row.unresolved_risk || null,
        };
      }
      setCandidate(row);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.warn('Failed to load candidate detail from backend:', err);
        setLoadError('Gagal menghubungi backend untuk memuat dossier kandidat.');
      }
    } finally {
      if (signal?.aborted) return;
      setIsLoadingDetail(false);
      setIsLoadingCandidate(false);
    }
  }, [candidateId]);

  // PII unmasking is reviewer-initiated and reason-logged: every call writes a
  // row into pii_access_logs, so it must never fire automatically on mount.
  const handleUnmask = useCallback(async () => {
    const reason = unmaskReason.trim();
    if (!candidateId || !reason) return;
    setIsUnmasking(true);
    setUnmaskError(null);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      // Role is derived server-side from the session token; sending it here is a
      // display hint only and carries no authorization weight.

      const res = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/unmask`, {
        method: 'POST',
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUnmaskError(payload.detail || `Gagal membuka identitas (${res.status})`);
        return;
      }
      if (payload.unmasked_data) {
        setUnmaskedIdentity(payload.unmasked_data);
        setIsUnmaskFormOpen(false);
        setUnmaskReason('');
      } else {
        setUnmaskError('Backend tidak mengembalikan data identitas.');
      }
    } catch (err) {
      setUnmaskError('Gagal menghubungi backend untuk membuka identitas.');
      console.warn('Unmasking request failed:', err);
    } finally {
      setIsUnmasking(false);
    }
  }, [candidateId, unmaskReason]);

  useEffect(() => {
    const controller = new AbortController();
    loadCandidateDetail(controller.signal);
    return () => controller.abort();
  }, [loadCandidateDetail]);

  // Clear any pending status-message timer on unmount
  useEffect(() => () => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
  }, []);

  // Merge candidate info with real backend candidate record. Both sources are
  // empty on the first render (candidate is fetched here, not passed in), so every
  // read must tolerate null.
  const activeCandidateObj = useMemo(() => {
    const rawCandidate = candidateDetail?.candidate || {};
    const row = candidate || {};
    return {
      ...row,
      ...rawCandidate,
      overall_score: rawCandidate.overall_score !== undefined && rawCandidate.overall_score !== null 
        ? rawCandidate.overall_score 
        : row.overall_score,
      recommendation: rawCandidate.recommendation || row.recommendation,
      confidence_level: rawCandidate.confidence_level || row.confidence_level,
      status: rawCandidate.status || row.status,
      github_url: rawCandidate.github_url || row.verified_github || row.github_url,
    };
  }, [candidate, candidateDetail]);

  // Mirrors the backend gate in unmask_candidate_pii: a recruiter cannot unmask a
  // candidate that has not been APPROVED_DISPATCH yet. Showing the form anyway
  // means the reviewer types a reason and then hits a button that cannot work.
  const unmaskBlock = unmaskBlockedReason(activeCandidateObj.status);

  // Identity is only ever unmasked through the explicit reviewer action above.
  // Until then show the blind-review hint (`B**i S*****o`) computed at ingest;
  // rows uploaded before migration 004 fall back to the masked identifier.
  const resolvedIdentity = useMemo(() => {
    const unmasked = unmaskedIdentity || {};
    const hint = candidateDetail?.candidate?.masked_name_hint || candidate?.masked_name_hint || null;
    return {
      name: unmasked.name || hint || candidate?.masked_identifier || 'Kandidat',
      email: unmasked.email || 'Disembunyikan',
      phone: unmasked.phone || 'Disembunyikan',
      isUnmasked: Boolean(unmasked.name || unmasked.email || unmasked.phone),
    };
  }, [candidate, candidateDetail, unmaskedIdentity]);

  const resolvedAnomalies = useMemo(() => {
    const raw = candidateDetail?.anomalies;
    if (Array.isArray(raw) && raw.length > 0) {
      const seen = new Set();
      const list = [];
      for (const a of raw) {
        const typeKey = (a.anomaly_type || '').replace(/_\d+_MONTHS$/, '');
        const meta = ANOMALY_DICTIONARY[typeKey] || ANOMALY_DICTIONARY[a.anomaly_type] || {};
        const desc = a.description || meta.defaultDesc || 'Terdeteksi anomali pada riwayat atau format berkas.';
        const key = `${a.anomaly_type}_${desc}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            id: a.id || `anom-${list.length}`,
            type: a.anomaly_type || 'ANOMALI_BERKAS',
            title: meta.title || a.anomaly_type || 'Peringatan Integritas Berkas',
            severity: a.severity || meta.severity || 'MEDIUM',
            description: desc,
            suggestedVerification: a.suggested_verification || meta.defaultAction || 'Lakukan konfirmasi kualitatif pada sesi wawancara.',
          });
        }
      }
      return list;
    }

    const flags = activeCandidateObj.flags || [];
    if (flags.length > 0) {
      const seen = new Set();
      const list = [];
      for (const flag of flags) {
        if (!seen.has(flag)) {
          seen.add(flag);
          const typeKey = flag.replace(/_\d+_MONTHS$/, '');
          const meta = ANOMALY_DICTIONARY[typeKey] || ANOMALY_DICTIONARY[flag] || {};
          list.push({
            id: `flag-${list.length}`,
            type: flag,
            title: meta.title || flag,
            severity: meta.severity || (flag.includes('SECURITY') || flag.includes('OVERLAP') ? 'HIGH' : 'MEDIUM'),
            description: meta.defaultDesc || 'Terdeteksi anomali pada evaluasi otomatis riwayat karier.',
            suggestedVerification: meta.defaultAction || 'Lakukan klarifikasi langsung ke kandidat saat sesi wawancara teknis.',
          });
        }
      }
      return list;
    }

    return [];
  }, [candidateDetail?.anomalies, activeCandidateObj.flags]);

  // The original PDF/DOCX is served by an authenticated endpoint, so a plain
  // <a href> would arrive without the Bearer token. Fetch it as a blob instead.
  const handleOpenResumeFile = useCallback(async () => {
    if (!candidateId) return;
    setResumeFileError(null);
    setIsLoadingResumeFile(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/resume-file`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setResumeFileError(payload.detail || `Gagal membuka berkas asli (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Revoke late: the new tab needs the URL to stay alive while it renders.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setResumeFileError('Gagal menghubungi backend untuk membuka berkas asli.');
      console.warn('Resume file fetch failed:', err);
    } finally {
      setIsLoadingResumeFile(false);
    }
  }, [candidateId]);

  // Trigger live AI triage
  const scheduleMessageClear = (delay) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = setTimeout(() => setAnalyzeMessage(null), delay);
  };

  const handleRunAIAnalysis = async () => {
    if (!candidateId) return;
    setIsAnalyzing(true);
    setAnalyzeMessage('Model sedang mengekstrak klaim CV dan menghitung skor 4D...');
    const before = candidateDetail?.candidate || {};
    const beforeScore = before.overall_score ?? null;
    const beforeRec = before.recommendation ?? null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/triage`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setIsAnalyzing(false);
        setAnalyzeMessage(`Gagal memicu analisis AI: ${err.detail || res.status}`);
        scheduleMessageClear(4000);
        return;
      }

      // Triage is dispatched as a background task, so completion has to be observed
      // by polling the dossier. A fixed sleep would report success on a job that
      // may still be running or may have failed.
      setAnalyzeMessage('Penyaringan berjalan di latar belakang. Menunggu hasil...');
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const poll = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}`);
        if (!poll.ok) continue;
        const json = await poll.json();
        const fresh = json?.candidate || {};
        if (fresh.overall_score !== beforeScore || fresh.recommendation !== beforeRec) {
          setCandidateDetail(json);
          loadCandidateDetail();
          setIsAnalyzing(false);
          setAnalyzeMessage('Analisis AI selesai. Skor dan bukti terbaru sudah dimuat.');
          scheduleMessageClear(4000);
          return;
        }
      }
      setIsAnalyzing(false);
      setAnalyzeMessage('Penyaringan melewati batas tunggu 2 menit. Muat ulang dossier beberapa saat lagi.');
      scheduleMessageClear(6000);
    } catch (err) {
      console.error('Triage run error:', err);
      setIsAnalyzing(false);
      setAnalyzeMessage('Gagal menghubungi layanan penyaringan.');
      scheduleMessageClear(4000);
    }
  };

  const isApproved = (activeCandidateObj.status || '').toLowerCase() === 'approved';
  const isRejected = (activeCandidateObj.status || '').toLowerCase() === 'rejected';
  const isDecisionFinal = isApproved || isRejected;
  const existingInterview = candidateDetail?.scheduled_interview || null;

  const handleConfirmSchedule = async () => {
    if (!interviewDate || !interviewTime) {
      setSubmitError('Pilih tanggal dan jam wawancara terlebih dahulu.');
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('decision', 'APPROVED_DISPATCH');
      formData.append('notes', interviewAgenda || 'Wawancara teknis disetujui via HR Recruiter Dashboard');
      formData.append('interview_date', interviewDate);
      formData.append('interview_time', interviewTime);
      formData.append('duration_minutes', String(durationMinutes));

      const res = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/review`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.detail || `Gagal menyimpan keputusan (${res.status})`);
        loadCandidateDetail();
        return; // stay on the schedule tab: the slot was NOT locked
      }

      const payload = await res.json().catch(() => ({}));
      setNotifications(payload.notifications || null);

      const cal = payload.notifications?.calendar || {};
      const eventId = cal.event_id || null;
      const exportUrl = cal.export_google_url || null;

      const [y, m, d] = interviewDate.split('-');
      const [hr, mn] = interviewTime.split(':');
      const startObj = new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(mn));
      const endObj = new Date(startObj.getTime() + durationMinutes * 60000);

      setBookedEvent({
        eventId,
        exportGoogleUrl: exportUrl,
        slot: {
          date: startObj.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Jakarta',
          }),
          time: `${startObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} - ${endObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB`,
          interviewer: 'Tim HR Recruiter',
        },
        timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      });
      setViewState('scheduled_done');
      loadCandidateDetail();
    } catch (err) {
      setSubmitError('Gagal menghubungi backend. Jadwal belum terkunci.');
      console.warn('Review submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('decision', 'REJECT_CONFIRMED');
      formData.append('notes', rejectReason);

      const res = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/review`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.detail || `Gagal menyimpan penolakan (${res.status})`);
        return; // stay on reject_confirm
      }

      const payload = await res.json().catch(() => ({}));
      setNotifications(payload.notifications || null);
      setViewState('reject_done');
      loadCandidateDetail();
    } catch (err) {
      setSubmitError('Gagal menghubungi backend. Penolakan belum tersimpan.');
      console.warn('Reject submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recommendation Badge Helper
  const recBadge = useMemo(() => {
    const rec = activeCandidateObj.recommendation;
    switch (rec) {
      case 'STRONG_MATCH':
        return {
          bg: 'bg-primary-info-soft text-primary-info border-primary-info-border',
          icon: CheckCircle2,
          label: 'Sangat Sesuai',
          desc: 'Kompetensi teknis dan portofolio selaras tinggi dengan kualifikasi posisi.'
        };
      case 'REVIEW_REQUIRED':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: AlertTriangle,
          label: 'Perlu Review HR',
          desc: 'Kompetensi memadai namun terdeteksi anomali operasional yang perlu klarifikasi langsung.'
        };
      case 'SECURITY_QUARANTINE':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: AlertTriangle,
          label: 'Karantina Keamanan',
          desc: 'Terdeteksi indikasi manipulasi prompt delimiter atau teks tersembunyi berisiko tinggi.'
        };
      case 'WEAK_FIT':
        return {
          bg: 'bg-primary-slate-100 text-primary-slate-700 border-primary-border-200',
          icon: Info,
          label: 'Kurang Sesuai',
          desc: 'Keahlian pelamar tidak mencakup persyaratan teknis inti untuk lowongan ini.'
        };
      default:
        return {
          bg: 'bg-primary-slate-100 text-primary-slate-600 border-primary-border-200',
          icon: Clock,
          label: rec || 'Menunggu Analisis',
          desc: 'Berkas belum dievaluasi oleh sistem penyaringan AI.'
        };
    }
  }, [activeCandidateObj.recommendation]);

  // A quarantined dossier must be resolved by compliance before any scheduling.
  const isQuarantined = activeCandidateObj.recommendation === 'SECURITY_QUARANTINE';

  // Decision-support copy built from the candidate's own record (score, extracted
  // technologies, recorded anomalies). This is a template, not model output: if the
  // backend ever returns a triage rationale, that text is used verbatim instead.
  const aiExplanation = useMemo(() => {
    const rec = activeCandidateObj.recommendation;
    const score = activeCandidateObj.overall_score;
    const scoreStr = formatScore(score);
    const tech = activeCandidateObj.key_technologies || [];
    const flags = activeCandidateObj.flags || [];
    const anomalies = candidateDetail?.anomalies || [];
    const backendRationale = activeCandidateObj.rationale || activeCandidateObj.ai_rationale || null;

    const anomalyText = anomalies.length
      ? anomalies.map((a) => a.description || a.anomaly_type).filter(Boolean).join('; ')
      : (flags.length ? flags.join('; ') : null);

    const strengthList = tech.length
      ? [`Teknologi terekstrak dari berkas: ${tech.join(', ')}.`]
      : ['Belum ada teknologi yang terekstrak dari berkas.'];

    if (rec === 'STRONG_MATCH') {
      return {
        isTemplate: !backendRationale,
        summary: backendRationale || `Skor evaluasi ${scoreStr}/100 dengan kategori "Sangat Sesuai". Berkas tidak memiliki anomali integritas tercatat.`,
        strengths: strengthList,
        risks: anomalyText || 'Tidak ada anomali tercatat pada berkas ini.',
        recommendation: 'Lanjut ke wawancara arsitektur teknis sistem.',
      };
    } else if (rec === 'REVIEW_REQUIRED') {
      return {
        isTemplate: !backendRationale,
        summary: backendRationale || `Skor evaluasi ${scoreStr}/100 dengan kategori "Perlu Review HR". Ada anomali tercatat yang perlu klarifikasi sebelum keputusan diambil.`,
        strengths: strengthList,
        risks: anomalyText || 'Status "Perlu Review HR" namun detail anomali tidak dikembalikan backend.',
        recommendation: 'Klarifikasi temuan anomali pada sesi wawancara sebelum dispatch penawaran.',
      };
    } else if (rec === 'SECURITY_QUARANTINE') {
      return {
        isTemplate: !backendRationale,
        summary: backendRationale || `Berkas diisolasi otomatis dengan status "Karantina Keamanan" karena indikasi manipulasi dokumen.`,
        strengths: strengthList,
        risks: anomalyText || 'Indikasi injeksi instruksi / teks tersembunyi terdeteksi, detail tidak dikembalikan backend.',
        recommendation: 'Tolak berkas atau lakukan audit manual oleh Compliance Officer.',
      };
    } else if (rec === 'WEAK_FIT') {
      return {
        isTemplate: !backendRationale,
        summary: backendRationale || `Skor evaluasi ${scoreStr}/100 dengan kategori "Kurang Sesuai". Kualifikasi inti posisi tidak terpenuhi.`,
        strengths: strengthList,
        risks: anomalyText || 'Keahlian teknis inti posisi tidak ditemukan pada berkas.',
        recommendation: 'Arsipkan berkas atau pertimbangkan untuk posisi lain yang lebih relevan.',
      };
    } else {
      return {
        isTemplate: true,
        summary: 'Berkas kandidat belum dievaluasi. Jalankan analisis AI untuk memicu ekstraksi kompetensi dan perhitungan skor 4D.',
        strengths: ['Menunggu hasil ekstraksi.'],
        risks: 'Menunggu audit integritas berkas.',
        recommendation: 'Jalankan analisis AI untuk mengevaluasi dossier ini.',
      };
    }
  }, [
    activeCandidateObj.recommendation,
    activeCandidateObj.overall_score,
    activeCandidateObj.key_technologies,
    activeCandidateObj.flags,
    activeCandidateObj.rationale,
    activeCandidateObj.ai_rationale,
    candidateDetail?.anomalies,
  ]);

  if (isLoadingCandidate && !candidate) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[350px] space-y-3 font-jkt" role="status" aria-live="polite">
        <div className="w-10 h-10 border-2 border-primary-orange/20 border-t-primary-orange rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-primary-black">Memuat dossier kandidat...</p>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center space-y-4 font-jkt">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 font-bold">
          !
        </div>
        <div>
          <h3 className="text-base font-extrabold text-primary-black">Dossier Tidak Dapat Dimuat</h3>
          <p className="text-xs text-primary-slate-600 mt-1">{loadError || 'Data kandidat tidak tersedia.'}</p>
        </div>
        <button
          type="button"
          onClick={goBack}
          className="px-5 py-2.5 bg-primary-orange text-white rounded-full text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-primary-orange/25"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="font-jkt">
      {/* Inline non-blocking load error banner */}
      {loadError && (
        <div className="mx-4 sm:mx-8 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2" role="alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Gagal menyinkronkan data terbaru: {loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            className="text-amber-800 hover:text-amber-950 font-bold text-[11px]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* PAGE HEADER: CANDIDATE IDENTITY & ACTIONS */}
      <div className="px-4 sm:px-8 pt-6 pb-0 border-b border-primary-border-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Identity Info Block */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={goBack}
                className="p-1.5 rounded-full text-primary-slate-500 hover:text-primary-black hover:bg-primary-slate-100 transition-colors"
                title="Kembali ke daftar kandidat"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-2xl font-extrabold text-primary-black tracking-tight">
                {resolvedIdentity.name}
              </h3>
              {!resolvedIdentity.isUnmasked && canUnmask && (
                <button
                  type="button"
                  onClick={() => { setIsUnmaskFormOpen(v => !v); setUnmaskError(null); }}
                  aria-label="Buka identitas kandidat"
                  aria-expanded={isUnmaskFormOpen}
                  title={unmaskBlock || 'Buka identitas — akses dicatat ke audit log UU PDP beserta alasannya'}
                  className="p-1.5 rounded-full text-primary-slate-500 hover:text-primary-info hover:bg-primary-info-soft border border-primary-border-200 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              {resolvedIdentity.isUnmasked && (
                <span className="p-1.5 rounded-full text-emerald-600 bg-emerald-50 border border-emerald-200" title="Identitas terbuka — tercatat di audit log">
                  <EyeOff className="w-4 h-4" />
                </span>
              )}
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-primary-slate-100 text-primary-black font-extrabold border border-primary-border-200">
                {candidate.masked_identifier}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${recBadge.bg}`}>
                <recBadge.icon className="w-3 h-3" />
                <span>{recBadge.label}</span>
              </span>
              {activeCandidateObj.overall_score !== null && activeCandidateObj.overall_score !== undefined && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-orange text-white font-mono font-bold shadow-xs">
                  Skor: {formatScore(activeCandidateObj.overall_score)}
                </span>
              )}
            </div>

            {/* Subtitle & Contact Badges */}
            <div className="flex items-center gap-3 text-xs text-primary-slate-500 flex-wrap pt-0.5">
              <span className="font-semibold text-primary-black">
                {candidate.job_title || 'Posisi tidak dilaporkan'}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-primary-blue" />
                <span>{resolvedIdentity.email}</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{resolvedIdentity.phone}</span>
              </span>
            </div>

            {/* Reason-gated unmask: every access is written to pii_access_logs.
                When the backend would refuse (blind review), say so here instead
                of offering a form whose submit button cannot work. */}
            {isUnmaskFormOpen && !resolvedIdentity.isUnmasked && canUnmask && (
              <div className="mt-2 p-3 rounded-xl bg-primary-slate-50 border border-primary-border-200 space-y-2">
                {unmaskBlock ? (
                  <div className="flex items-start gap-2 text-[11px] text-amber-900">
                    <Lock className="w-3.5 h-3.5 shrink-0 mt-px text-amber-600" />
                    <span>{unmaskBlock}</span>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-primary-slate-700">
                      Akses PII akan tercatat pada audit log beserta alasan dan identitas reviewer Anda.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={unmaskReason}
                        onChange={(e) => setUnmaskReason(e.target.value)}
                        placeholder="Alasan akses (min. 10 karakter), mis. verifikasi berkas untuk wawancara"
                        className="flex-1 bg-white border border-primary-border-200 rounded-lg text-xs text-primary-slate-900 px-2.5 py-1.5 focus:outline-none focus:border-primary-info"
                      />
                      <button
                        type="button"
                        onClick={handleUnmask}
                        disabled={isUnmasking || unmaskReason.trim().length < 10}
                        className="px-3 py-1.5 bg-primary-info hover:bg-primary-info-dark disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                      >
                        {isUnmasking ? 'Memproses...' : 'Buka Identitas'}
                      </button>
                    </div>
                  </>
                )}
                {unmaskError && (
                  <p className="text-[11px] text-rose-700 font-medium">{unmaskError}</p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons: Run AI Triage + Close */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleRunAIAnalysis}
              disabled={isAnalyzing || !can('batchTriage')}
              className="px-4 py-2 bg-primary-orange hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-full shadow-lg shadow-primary-orange/25 transition-all flex items-center gap-1.5"
              title={!can('batchTriage') ? 'Peran Anda tidak berwenang menjalankan AI Triage' : 'Picu penyaringan AI untuk memindai berkas dan memperbarui skor 4D di database'}
            >
              <Sparkles className={`w-3.5 h-3.5 text-white ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Menganalisis Berkas CV...' : 'Jalankan Analisis AI'}</span>
            </button>

          </div>
        </div>

          {/* Real-time Triage Status Notification */}
          {analyzeMessage && (
            <div className="mt-3 p-2.5 rounded-xl bg-primary-blue/10 border border-primary-blue/30 text-primary-black text-xs font-medium flex items-center gap-2 animate-fade-in">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-primary-blue" />
              <span>{analyzeMessage}</span>
            </div>
          )}

          {/* TAB NAVIGATION BAR */}
          <div className="mt-4 flex items-center gap-1 border-b border-primary-border-100 pt-1 overflow-x-auto scrollbar-none sticky top-16 z-20 bg-white">
            {[
              { key: 'summary', Icon: Sparkles, label: 'Penjelasan & Evaluasi AI' },
              { key: 'graph', Icon: GitBranch, label: 'Evidence Graph Flow' },
              { key: 'cv', Icon: FileText, label: 'Dokumen CV / Resume' },
              { key: 'schedule', Icon: Calendar, label: isApproved ? 'Jadwal Wawancara (Terkunci)' : 'Jadwalkan Wawancara' },
            ].map(({ key, Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setViewState('dossier'); setActiveTab(key); }}
                className={`pb-3 px-3.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all shrink-0 ${
                  viewState === 'dossier' && activeTab === key
                    ? 'border-primary-orange text-primary-orange font-bold'
                    : 'border-transparent text-primary-slate-500 hover:text-primary-black'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {key === 'graph' && candidateDetail?.evidence?.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary-orange/10 text-primary-orange font-mono font-bold">
                    {candidateDetail.evidence.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* PAGE BODY */}
        <div className="px-4 sm:px-8 py-6 bg-white">
          <div className="max-w-7xl mx-auto">
          {/* TAB 1: SUMMARY & AI EXPLANATION */}
          {viewState === 'dossier' && activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start animate-fade-in">

              {/* LEFT: narrative, objective scores, decision signals */}
              <div className="space-y-6 min-w-0">
              
              {/* AI Executive Assessment Narrative Card */}
              <div className="p-5 rounded-2xl bg-primary-slate-50 border border-primary-border-200 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-primary-border-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-info" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary-slate-900">
                      Rasional Evaluasi {aiExplanation.isTemplate ? '(Template Kategori Rekomendasi)' : '(Dari Hasil Penyaringan Backend)'}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-primary-info font-semibold border border-primary-info-border">
                    {aiExplanation.isTemplate ? 'TEMPLATE' : 'BACKEND RATIONALE'}
                  </span>
                </div>

                <p className="text-xs text-primary-slate-900 leading-relaxed font-medium">
                  {aiExplanation.summary}
                </p>

                {/* Key Strengths & Risk Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-white border border-primary-border-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Kekuatan Utama Terdeteksi
                    </span>
                    {activeCandidateObj.key_technologies && activeCandidateObj.key_technologies.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-primary-slate-600 font-medium">Teknologi &amp; Kompetensi Terekstrak:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeCandidateObj.key_technologies.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-primary-slate-500 italic">
                        Belum ada teknologi yang terekstrak dari berkas.
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-primary-border-200 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Potensi Risiko / Hal Perlu Diverifikasi
                      </span>
                      {resolvedAnomalies.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          {resolvedAnomalies.length} temuan
                        </span>
                      )}
                    </div>

                    {resolvedAnomalies.length > 0 ? (
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {resolvedAnomalies.map((anom, idx) => (
                          <div
                            key={anom.id || idx}
                            className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/70 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-rose-950 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                {anom.title}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase text-white shrink-0 ${
                                  anom.severity === 'HIGH' ? 'bg-rose-600' : 'bg-amber-600'
                                }`}
                              >
                                {anom.severity === 'HIGH' ? 'Kritis' : 'Perhatian'}
                              </span>
                            </div>
                            <p className="text-primary-slate-800 leading-snug pl-3 text-[11px]">
                              {anom.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-emerald-800 text-[11px] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Tidak ada anomali atau risiko integritas berkas tercatat.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Next Steps for Recruiter */}
                <div className="p-3 rounded-xl bg-primary-info-soft border border-primary-info-border text-xs text-primary-info flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 shrink-0" />
                    <span><strong>Rekomendasi Rekruter:</strong> {aiExplanation.recommendation}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('graph')}
                    className="px-2.5 py-1 bg-primary-info hover:bg-primary-info-dark text-white rounded-lg text-[10px] font-bold shrink-0 transition-colors flex items-center gap-1"
                  >
                    <span>Buka Graph Flow</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 4D Objective Scoring Grid */}
              <div>
                <h4 className="text-xs font-bold text-primary-slate-600 uppercase tracking-wider mb-2.5">
                  4 Dimensi Evaluasi Obyektif (PRD Bab 4.2)
                </h4>
                {activeCandidateObj.scores_4d ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {DIMENSIONS.map((d) => (
                      <div key={d.key} className="p-3.5 rounded-xl bg-primary-slate-100 border border-primary-border-100 text-center">
                        <span className="text-[10px] text-primary-slate-600 uppercase font-semibold">{d.label}</span>
                        <div className={`text-xl font-extrabold mt-0.5 tabular-nums ${d.text}`}>
                          {Math.round(activeCandidateObj.scores_4d[d.key] ?? 0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-primary-slate-100 border border-primary-border-100 text-xs text-primary-slate-600 text-center">
                    Berkas belum dianalisis oleh AI. Klik tombol <strong>"Jalankan Analisis AI"</strong> di atas untuk memindai berkas ini.
                  </div>
                )}
              </div>

              {/* Confidence & risk are decision signals, not scoring dimensions —
                  keeping them inside the 4D grid is what made the numbers look wrong. */}
              {(activeCandidateObj.confidence_level || activeCandidateObj.unresolved_risk) && (
                <div>
                  <h4 className="text-xs font-bold text-primary-slate-600 uppercase tracking-wider mb-2">
                    Sinyal Keputusan
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-primary-slate-600">Keyakinan Bukti</span>
                      <span className="text-xs font-extrabold text-primary-black">{confidenceLabel(activeCandidateObj.confidence_level)}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-primary-slate-600">Risiko Tak Terurai</span>
                      <span className={`text-xs font-extrabold ${
                        activeCandidateObj.unresolved_risk === 'HIGH' ? 'text-rose-700'
                        : activeCandidateObj.unresolved_risk === 'MEDIUM' ? 'text-amber-700'
                        : 'text-emerald-700'
                      }`}>
                        {riskLabel(activeCandidateObj.unresolved_risk)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Competencies Taxonomy */}
              <div>
                <h4 className="text-xs font-bold text-primary-slate-600 uppercase tracking-wider mb-2">
                  Taksonomi Keahlian &amp; Kompetensi Terverifikasi
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {activeCandidateObj.key_technologies && activeCandidateObj.key_technologies.length > 0 ? (
                    activeCandidateObj.key_technologies.map((tech, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 rounded-xl bg-primary-slate-100 text-primary-slate-900 border border-primary-border-200 font-medium font-mono">
                        {tech}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-primary-slate-600">Belum ada keahlian yang terekstrak.</span>
                  )}
                </div>
              </div>

              {/* Anomaly & Risk Flags with Human-in-the-Loop Clarification Guide */}
              {resolvedAnomalies.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                        Peringatan Anomali &amp; Manipulasi Dokumen ({resolvedAnomalies.length})
                      </h4>
                    </div>
                    <span className="text-[11px] text-primary-slate-500 font-medium">
                      Perlu Klarifikasi HR (HITL)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {resolvedAnomalies.map((anom) => {
                      const isHigh = anom.severity === 'HIGH';
                      const isMedium = anom.severity === 'MEDIUM';

                      return (
                        <div
                          key={anom.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isHigh
                              ? 'bg-rose-50/70 border-rose-200 text-rose-950 shadow-xs'
                              : isMedium
                              ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                              : 'bg-primary-slate-50 border-primary-border-200 text-primary-slate-900'
                          }`}
                        >
                          {/* Header: Title, Technical Tag, Severity Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-rose-200/60">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className={`w-4 h-4 shrink-0 ${isHigh ? 'text-rose-600' : 'text-amber-600'}`} />
                              <span className="font-extrabold text-xs text-primary-black">
                                {anom.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 font-semibold">
                                {anom.type}
                              </span>
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider text-white ${
                                  isHigh ? 'bg-rose-600' : isMedium ? 'bg-amber-600' : 'bg-primary-slate-600'
                                }`}
                              >
                                {isHigh ? 'Risiko Tinggi' : isMedium ? 'Perhatian' : 'Informatif'}
                              </span>
                            </div>
                          </div>

                          {/* Body: Description */}
                          <div className="mt-2.5 text-xs text-primary-slate-800 leading-relaxed">
                            <p className="font-semibold text-primary-slate-900 mb-1">Uraian Temuan Sistem:</p>
                            <p className="bg-white/80 p-2.5 rounded-xl border border-rose-200/50">
                              {anom.description}
                            </p>
                          </div>

                          {/* Footer Guide: Suggested Verification for HR */}
                          {anom.suggestedVerification && (
                            <div className="mt-2.5 p-3 rounded-xl bg-white border border-primary-border-200 space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-primary-black">
                                <HelpCircle className="w-3.5 h-3.5 text-primary-orange shrink-0" />
                                <span>Panduan Klarifikasi untuk HR:</span>
                              </div>
                              <p className="text-xs text-primary-slate-700 leading-relaxed pl-5">
                                {anom.suggestedVerification}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="pt-4 border-t border-primary-border-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <span className="text-xs text-primary-slate-600 text-center sm:text-left">
                  Rekomendasi Keputusan AI: <strong className="text-primary-slate-900">{recLabel(activeCandidateObj.recommendation)}</strong>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('graph')}
                    className="px-3.5 py-2.5 bg-primary-info-soft hover:bg-primary-info-border text-primary-info font-semibold text-xs rounded-xl border border-primary-info-border transition-colors flex items-center gap-1.5"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-primary-info" />
                    <span>Evidence Graph Flow</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cv')}
                    className="px-3.5 py-2.5 bg-white hover:bg-primary-slate-100 text-primary-slate-900 font-semibold text-xs rounded-xl border border-primary-border-200 transition-colors flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary-info" />
                    <span>Lihat Dokumen CV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('schedule')}
                    disabled={isQuarantined || (!canReview && !isApproved) || isRejected}
                    title={
                      isRejected
                        ? 'Kandidat telah ditolak'
                        : !canReview && !isApproved
                        ? `Role ${roleLabel()} tidak berwenang mereview keputusan`
                        : isQuarantined
                        ? 'Kandidat dalam karantina keamanan — tidak dapat dijadwalkan'
                        : undefined
                    }
                    className="px-4 py-2.5 bg-primary-info hover:bg-primary-info-dark text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-3.5 h-3.5 text-white" />
                    <span>{isApproved ? 'Lihat Jadwal Wawancara' : 'Approve & Schedule'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewState('reject_confirm')}
                    disabled={!canReview || isDecisionFinal}
                    title={
                      isDecisionFinal
                        ? `Keputusan sudah final (${activeCandidateObj.status})`
                        : !canReview
                        ? `Role ${roleLabel()} tidak berwenang menolak kandidat`
                        : undefined
                    }
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reject
                  </button>
                </div>
              </div>
              </div>{/* /left column */}

              {/* RIGHT RAIL: portfolio summary, sticky on desktop */}
              <aside className="space-y-3 lg:sticky lg:top-4">
                <div className="p-4 rounded-2xl bg-primary-slate-50 border border-primary-border-200 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-600 block">
                    Ringkasan Portofolio
                  </span>

                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-primary-slate-600 block">Skor Total</span>
                      <span className="text-3xl font-extrabold text-primary-black tabular-nums leading-none">
                        {formatScore(activeCandidateObj.overall_score)}
                      </span>
                      <span className="text-[10px] text-primary-slate-500 font-mono"> /100</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${recBadge.bg}`}>
                      <recBadge.icon className="w-3 h-3" />
                      <span>{recBadge.label}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-primary-border-200 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-primary-slate-600">Status</span>
                      <span className="font-bold text-primary-slate-900 text-right">{statusLabel(activeCandidateObj.status)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-primary-slate-600">Posisi</span>
                      <span className="font-semibold text-primary-slate-900 text-right truncate">{candidate.job_title || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-primary-slate-600">Keyakinan</span>
                      <span className="font-bold text-primary-slate-900">{confidenceLabel(activeCandidateObj.confidence_level)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-primary-slate-600">Terdaftar</span>
                      <span className="font-semibold text-primary-slate-900">
                        {candidateDetail?.candidate?.created_at
                          ? new Date(candidateDetail.candidate.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {(safeUrl(activeCandidateObj.github_url) || safeUrl(activeCandidateObj.portfolio_url)) && (
                    <div className="pt-2 border-t border-primary-border-200 space-y-1">
                      {safeUrl(activeCandidateObj.github_url) && (
                        <a
                          href={safeUrl(activeCandidateObj.github_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-info hover:underline min-w-0"
                        >
                          <GitBranch className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{activeCandidateObj.github_url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                        </a>
                      )}
                      {safeUrl(activeCandidateObj.portfolio_url) && (
                        <a
                          href={safeUrl(activeCandidateObj.portfolio_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-info hover:underline min-w-0"
                        >
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{activeCandidateObj.portfolio_url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}

          {/* TAB 2: EMBEDDED EVIDENCE GRAPH FLOW (REACT FLOW) */}
          {viewState === 'dossier' && activeTab === 'graph' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h4 className="text-sm font-bold text-primary-slate-900 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary-info" />
                    <span>Interactive Evidence Graph &bull; Grounding Substring Guard</span>
                  </h4>
                  <p className="text-[11px] text-primary-slate-600 mt-0.5">
                    Menghubungkan klaim keahlian kandidat langsung ke kutipan kalimat asli resume di database dan audit portofolio GitHub.
                  </p>
                </div>
              </div>

              {/* Render React Flow Graph Embedded */}
              <CandidateEvidenceGraph 
                candidate={activeCandidateObj} 
                onReloadCandidates={() => loadCandidateDetail()}
                embedded={true}
                initialDetail={candidateDetail}
              />
            </div>
          )}

          {/* TAB 3: RESUME / CV DOCUMENT VIEWER */}
          {viewState === 'dossier' && activeTab === 'cv' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-primary-border-200">
                <div>
                  <h4 className="text-sm font-bold text-primary-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary-info" />
                    <span>Dokumen Berkas Resume / CV Pelamar</span>
                  </h4>
                  <p className="text-[11px] text-primary-slate-600 mt-0.5">
                    Teks asli hasil ekstraksi parser PDF/DOCX yang telah disanitasi dari PII sensitif sesuai standar UU PDP No. 27/2022.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-primary-info-soft text-primary-info border border-primary-info-border">
                    VERBATIM PARSER
                  </span>
                  {candidateDetail?.candidate?.resume_file_available && (
                    <button
                      type="button"
                      onClick={handleOpenResumeFile}
                      disabled={isLoadingResumeFile}
                      title="Buka berkas PDF/DOCX asli yang diunggah pelamar — akses dicatat ke audit log"
                      className="text-[10px] font-bold px-2.5 py-1 rounded bg-white text-primary-slate-900 border border-primary-border-200 hover:border-primary-info transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <FileText className="w-3 h-3" />
                      <span>{isLoadingResumeFile ? 'Membuka...' : `Berkas Asli (${(candidateDetail.candidate.resume_file_format || '').toUpperCase()})`}</span>
                    </button>
                  )}
                </div>
              </div>

              {resumeFileError && (
                <p className="text-[11px] text-rose-700 font-medium">{resumeFileError}</p>
              )}

              {/* Document Paper Container */}
              <div className="p-6 rounded-2xl bg-primary-slate-50 border border-primary-border-200 shadow-inner font-mono text-xs text-primary-slate-1000 space-y-4 max-h-[500px] overflow-y-auto leading-relaxed">
                {candidateDetail?.candidate?.sanitized_resume_text ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-primary-slate-1000">
                    {candidateDetail.candidate.sanitized_resume_text}
                  </pre>
                ) : (
                  <div className="py-12 text-center text-primary-slate-600">
                    <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-primary-slate-900">Teks Resume Belum Tersedia di Cache</p>
                    <p className="text-xs text-primary-slate-600 mt-1 max-w-sm mx-auto">
                      Klik tombol <strong>"Jalankan Analisis AI"</strong> di sudut kanan atas untuk mengekstrak dan memverifikasi isi CV pelamar ini.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SCHEDULE INTERVIEW & CALENDAR ATOMIC LOCK */}
          {viewState === 'dossier' && activeTab === 'schedule' && (
            <div className="space-y-5 animate-fade-in">
              {/* If already scheduled / approved: show locked schedule view */}
              {existingInterview || isApproved ? (
                <div className="p-6 rounded-2xl bg-white border-2 border-emerald-500/40 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-primary-border-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <h4 className="text-sm font-extrabold text-primary-slate-900">
                        Jadwal Wawancara Terkunci (ACID Lock)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold uppercase">
                      Status: Terkunci &bull; Booked
                    </span>
                  </div>

                  <p className="text-xs text-primary-slate-700 leading-relaxed">
                    Kandidat <strong>{resolvedIdentity.name} ({candidate.masked_identifier})</strong> telah dijadwalkan untuk tahap wawancara teknis. Sesuai prinsip integritas rekrutmen kedaulatan internal, jadwal wawancara hanya dapat diproses satu kali per kandidat.
                  </p>

                  {existingInterview && (
                    <div className="p-4 rounded-xl bg-primary-slate-50 border border-primary-border-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-primary-slate-600 font-medium">Waktu Sesi:</span>
                        <span className="font-bold text-primary-slate-900">
                          {new Date(existingInterview.start_time).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' })}, {new Date(existingInterview.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} - {new Date(existingInterview.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-primary-slate-600 font-medium">Pewawancara:</span>
                        <span className="font-semibold text-primary-slate-900">{existingInterview.interviewer_name || 'Tim HR Recruiter'}</span>
                      </div>
                      {existingInterview.event_id && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-primary-border-100">
                          <span className="text-primary-slate-600 font-medium font-mono text-[11px]">Event Lock ID:</span>
                          <span className="font-mono text-[11px] text-primary-info font-bold">{existingInterview.event_id}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1-Click Google Calendar export button */}
                  {(existingInterview?.export_google_url || notifications?.calendar?.export_google_url) && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                      <a
                        href={safeUrl(existingInterview?.export_google_url || notifications?.calendar?.export_google_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-5 py-2.5 bg-primary-black text-white hover:bg-primary-blue rounded-full text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <span>Buka di Google Calendar Pribadi</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <span className="text-[11px] text-primary-slate-500">
                        1-Klik ekspor langsung tanpa autentikasi OAuth (Zero-Credential).
                      </span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-primary-border-100 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('summary')}
                      className="px-4 py-2 bg-primary-slate-100 hover:bg-primary-slate-200 text-primary-slate-900 text-xs font-semibold rounded-full transition-colors"
                    >
                      Kembali ke Ringkasan
                    </button>
                  </div>
                </div>
              ) : (
                /* If NOT yet scheduled: direct Date & Time Form */
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-primary-info-soft border border-primary-info-border flex items-start gap-3">
                    <Lock className="w-5 h-5 text-primary-info shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold text-primary-slate-900">
                        Jadwalkan Wawancara Langsung (Atomic Calendar Lock Protocol):
                      </span>
                      <p className="text-primary-slate-700 mt-0.5 leading-relaxed">
                        Tentukan tanggal dan jam wawancara untuk kandidat <strong>{resolvedIdentity.name} ({candidate.masked_identifier})</strong>. Slot waktu akan dikunci secara ACID di database lokal MariaDB untuk mencegah bentrok jadwal.
                      </p>
                    </div>
                  </div>

                  {/* FORM INPUT TANGGAL & JAM */}
                  <div className="p-5 rounded-2xl bg-white border border-primary-border-200 space-y-4 shadow-2xs">
                    <h4 className="text-xs font-bold text-primary-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary-info" />
                      <span>Atur Waktu Wawancara</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-primary-slate-800 block mb-1.5">
                          Tanggal Wawancara
                        </label>
                        <input
                          type="date"
                          value={interviewDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setInterviewDate(e.target.value)}
                          className="w-full bg-white border border-primary-border-200 rounded-xl text-xs text-primary-slate-900 p-2.5 focus:outline-none focus:border-primary-info font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-primary-slate-800 block mb-1.5">
                          Jam Mulai (WIB)
                        </label>
                        <input
                          type="time"
                          value={interviewTime}
                          onChange={(e) => setInterviewTime(e.target.value)}
                          className="w-full bg-white border border-primary-border-200 rounded-xl text-xs text-primary-slate-900 p-2.5 focus:outline-none focus:border-primary-info font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-primary-slate-800 block mb-1.5">
                          Durasi Sesi
                        </label>
                        <select
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          className="w-full bg-white border border-primary-border-200 rounded-xl text-xs text-primary-slate-900 p-2.5 focus:outline-none focus:border-primary-info font-medium"
                        >
                          <option value={30}>30 Menit</option>
                          <option value={45}>45 Menit</option>
                          <option value={60}>60 Menit (1 Jam)</option>
                          <option value={90}>90 Menit (1,5 Jam)</option>
                          <option value={120}>120 Menit (2 Jam)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-primary-slate-800 block mb-1.5">
                          Agenda / Topik Sesi
                        </label>
                        <input
                          type="text"
                          value={interviewAgenda}
                          onChange={(e) => setInterviewAgenda(e.target.value)}
                          placeholder="Misal: Technical System Architecture Interview"
                          className="w-full bg-white border border-primary-border-200 rounded-xl text-xs text-primary-slate-900 p-2.5 focus:outline-none focus:border-primary-info font-medium"
                        />
                      </div>
                    </div>

                    {/* Live Schedule Preview */}
                    {interviewDate && interviewTime && (
                      <div className="p-3.5 rounded-xl bg-primary-slate-50 border border-primary-border-200 text-xs space-y-1">
                        <span className="text-[10px] uppercase font-bold text-primary-slate-500 block">
                          Ringkasan Jadwal yang Akan Dikunci:
                        </span>
                        <p className="font-semibold text-primary-slate-900">
                          {(() => {
                            try {
                              const [y, m, d] = interviewDate.split('-');
                              const [hr, mn] = interviewTime.split(':');
                              const s = new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(mn));
                              const e = new Date(s.getTime() + durationMinutes * 60000);
                              return `${s.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' })}, ${s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} - ${e.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB (${durationMinutes} Menit)`;
                            } catch {
                              return `${interviewDate} pukul ${interviewTime} WIB`;
                            }
                          })()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Decision failure: the slot was NOT locked */}
                  {submitError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Jadwal belum tersimpan.</p>
                        <p className="leading-snug">{submitError}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-primary-border-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('summary')}
                      className="px-5 py-2.5 rounded-full bg-primary-slate-100 hover:bg-primary-slate-200 text-primary-black text-xs font-semibold transition-colors text-center"
                    >
                      Kembali ke Ringkasan
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting || !interviewDate || !interviewTime || isQuarantined || !canReview}
                      onClick={handleConfirmSchedule}
                      title={!canReview ? `Role ${roleLabel()} tidak berwenang menyetujui keputusan` : isQuarantined ? 'Kandidat dalam karantina keamanan' : undefined}
                      className="px-6 py-2.5 bg-primary-orange hover:opacity-90 text-white font-bold text-xs rounded-full shadow-lg shadow-primary-orange/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Mengunci Jadwal Transaksional...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-white" />
                          <span>Konfirmasi Kunci Jadwal (Atomic Lock)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: SCHEDULED SUCCESS RECEIPT */}
          {viewState === 'scheduled_done' && bookedEvent && (
            <div className="space-y-5 animate-fade-in text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-primary-slate-900">
                  Wawancara Berhasil Dijadwalkan!
                </h3>
                <p className="text-xs text-primary-slate-600 max-w-md mx-auto">
                  Slot kalender telah dikunci secara atomik pada database dan status kandidat diperbarui menjadi <strong className="text-primary-info">Approved &amp; Scheduled</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-primary-slate-50 border border-primary-border-200 max-w-md mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-primary-border-200">
                  <span className="text-primary-slate-600">Kandidat:</span>
                  <span className="font-mono font-bold text-primary-slate-900">{resolvedIdentity.name} ({candidate.masked_identifier})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-primary-border-200">
                  <span className="text-primary-slate-600">Waktu:</span>
                  <span className="font-semibold text-primary-slate-900">{bookedEvent.slot.date} &bull; {bookedEvent.slot.time}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-primary-border-200">
                  <span className="text-primary-slate-600">Pewawancara:</span>
                  <span className="font-semibold text-primary-slate-900">{bookedEvent.slot.interviewer}</span>
                </div>
                <div className="py-1">
                  <span className="text-primary-slate-600 block mb-0.5">Event ID Transaksional:</span>
                  <code className="text-primary-info font-mono text-[10px] break-all bg-white p-1 rounded border border-primary-border-200 block">
                    {bookedEvent.eventId || 'Tidak dilaporkan backend — cek status notifikasi di bawah'}
                  </code>
                </div>
              </div>

              <div className="max-w-md mx-auto">
                <DeliveryReport notifications={notifications} />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="px-6 py-2.5 bg-primary-info hover:bg-primary-info-dark text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
                >
                  Selesai &amp; Kembali ke Daftar
                </button>
              </div>
            </div>
          )}

          {/* VIEW: REJECT CONFIRMATION */}
          {viewState === 'reject_confirm' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Konfirmasi Penolakan Berkas Pelamar:</span>
                  <p className="mt-0.5 leading-relaxed text-rose-800">
                    Kandidat <strong>{resolvedIdentity.name} ({candidate.masked_identifier})</strong> akan dipindahkan ke arsip ditolak. 
                    Kandidat dapat menggunakan hak penghapusan data mandiri (<em>Right to Erasure</em>) melalui token pelacakan mereka.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-primary-slate-900 block mb-1.5 uppercase tracking-wider">
                  Alasan Penolakan Evaluasi:
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-white border border-primary-border-200 rounded-xl text-xs text-primary-slate-900 p-3 focus:outline-none focus:border-rose-500 font-medium"
                >
                  <option value="Skor keahlian di bawah threshold kompetensi posisi">
                    Skor keahlian di bawah threshold kompetensi posisi (&lt; 60.0)
                  </option>
                  <option value="Terdeteksi anomali teks tersembunyi / manipulasi format">
                    Terdeteksi anomali teks tersembunyi / manipulasi format (Security Quarantine)
                  </option>
                  <option value="Overlapping timeline karier tidak terverifikasi">
                    Overlapping timeline karier tidak terverifikasi (&gt; 3 bulan)
                  </option>
                  <option value="Ketidakcocokan domain lowongan (Misal non-programmer melamar backend)">
                    Ketidakcocokan domain lowongan (Misal non-programmer melamar backend)
                  </option>
                </select>
              </div>

              <div className="pt-4 border-t border-primary-border-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewState('dossier')}
                  className="px-4 py-2.5 rounded-xl bg-primary-slate-100 hover:bg-primary-border-200 text-primary-slate-900 text-xs font-semibold transition-colors text-center"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !canReview}
                  onClick={handleConfirmReject}
                  title={canReview ? undefined : `Role ${roleLabel()} tidak berwenang menolak kandidat`}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 text-center"
                >
                  {isSubmitting ? 'Memproses Penolakan...' : 'Konfirmasi Penolakan Berkas'}
                </button>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Penolakan belum tersimpan.</p>
                    <p className="leading-snug">{submitError}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: REJECTED SUCCESS */}
          {viewState === 'reject_done' && (
            <div className="space-y-4 animate-fade-in text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center border border-rose-200">
                <XCircle className="w-8 h-8 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-primary-slate-900">
                  Kandidat Telah Ditolak
                </h3>
                <p className="text-xs text-primary-slate-600 max-w-sm mx-auto">
                  Status kandidat {resolvedIdentity.name} ({candidate.masked_identifier}) telah ditandai ditolak. Alasan dicatat dalam audit trail sistem.
                </p>
              </div>
              <div className="max-w-md mx-auto">
                <DeliveryReport notifications={notifications} />
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="px-6 py-2.5 bg-primary-slate-1000 hover:bg-primary-slate-1000 text-white text-xs font-semibold rounded-xl transition-all"
                >
                  Kembali ke Daftar
                </button>
              </div>
            </div>
          )}

          </div>
        </div>
    </div>
  );
}
