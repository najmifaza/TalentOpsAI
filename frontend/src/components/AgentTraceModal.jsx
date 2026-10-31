import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Radio,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';
import { issueSseTicket } from '../lib/api';

// 7 Canonical Steps mapped to Backend Broadcaster events
const BACKEND_STEPS = [
  {
    key: 'triage_initiated',
    title: '1. Sensor Privasi Data Pribadi',
    subtitle: 'Penyensoran nama, kontak, gender & kampus asal (UU PDP No. 27/2022)',
    timeTarget: '< 20 ms',
  },
  {
    key: 'hidden_text_audit',
    title: '2. Uji Integritas Dokumen Resume',
    subtitle: 'Pemindaian teks tersembunyi, font putih siluman, dan manipulasi DOCX',
    timeTarget: '< 15 ms',
  },
  {
    key: 'llm_extraction',
    title: '3. Ekstraksi Kompetensi LLM Gemini',
    subtitle: 'Ekstraksi klaim keahlian terstruktur suhu 0.0 deterministik',
    timeTarget: '~ 1.2 s',
  },
  {
    key: 'substring_guard_audit',
    title: '4. Validasi Substring Guard Bukti Resume',
    subtitle: 'Verifikasi klaim keahlian langsung ke kutipan teks asli resume',
    timeTarget: '< 10 ms',
  },
  {
    key: 'github_repo_verification',
    title: '5. Audit Portofolio & Repositori GitHub',
    subtitle: 'Pemeriksaan repositori publik, bahasa kode, dan status commit GitHub',
    timeTarget: '~ 85 ms',
  },
  {
    key: 'deterministic_scoring',
    title: '6. Perhitungan Skor Obyektif 4 Dimensi',
    subtitle: 'Penilaian formula deterministik: S_comp, S_port, S_conf, S_risk',
    timeTarget: '< 2 ms',
  },
  {
    key: 'triage_completed',
    title: '7. Keputusan Akhir & Kunci Kalender',
    subtitle: 'Penetapan status rekomendasi & reservasi kalender wawancara',
    timeTarget: '< 5 ms',
  }
];

const STEP_INDEX_MAP = {
  'triage_initiated': 0,
  'pii_sanitization': 0,
  'hidden_text_audit': 1,
  'docx_integrity': 1,
  'llm_extraction': 2,
  'substring_guard_audit': 3,
  'substring_guard': 3,
  'github_repo_verification': 4,
  'github_audit': 4,
  'deterministic_scoring': 5,
  'triage_completed': 6,
  'agent_decision': 6
};

export default function AgentTraceModal({ candidate, isOpen, onClose, onTriageComplete }) {
  const [events, setEvents] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [streamStatus, setStreamStatus] = useState('IDLE'); // 'CONNECTING' | 'STREAMING' | 'COMPLETED' | 'ERROR'
  const [streamError, setStreamError] = useState(null);
  const logContainerRef = useRef(null);
  const sseRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const playTimerRef = useRef(null);
  const startedRef = useRef(false);
  const isCompletedRef = useRef(false);

  const candidateId = candidate?.id;
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.talentops.ai.id';

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  const cleanupConnections = () => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (e) {}
      sseRef.current = null;
    }
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    queueRef.current = [];
    isPlayingRef.current = false;
  };

  const processNextInQueue = () => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const item = queueRef.current.shift();

    if (item.stepIdx !== -1) {
      setActiveStepIndex(item.stepIdx);
    }

    setEvents(prev => [...prev, {
      time: item.time,
      step: item.stepTitle,
      status: item.status,
      details: item.details
    }]);

    if (item.isFinalStep) {
      setStreamStatus('COMPLETED');
      setIsStreaming(false);
      isPlayingRef.current = false;
      isCompletedRef.current = true;

      if (sseRef.current) {
        try { sseRef.current.close(); } catch (e) {}
        sseRef.current = null;
      }

      if (onTriageComplete && candidateId) {
        onTriageComplete(candidateId, item.triageResult);
      }
      return;
    }

    playTimerRef.current = setTimeout(() => {
      processNextInQueue();
    }, 600);
  };

  // Connect to Real-time Backend SSE Stream
  const startStream = async () => {
    cleanupConnections();
    setEvents([]);
    setActiveStepIndex(-1);
    setIsStreaming(true);
    setStreamStatus('CONNECTING');
    setStreamError(null);

    const candidateId = candidate?.id || 1;
    let hasReceivedEvent = false;

    try {
      // 1. Exchange JWT for a single-use SSE ticket, then open authenticated stream first
      const ticket = await issueSseTicket(candidateId);
      const sseSource = new EventSource(
        `${API_BASE_URL}/api/candidates/${candidateId}/trace-stream?ticket=${encodeURIComponent(ticket)}`
      );
      sseRef.current = sseSource;

      // Watchdog: If server stream gives no event within 15s (accounting for LLM inference)
      const streamWatchdog = setTimeout(() => {
        if (!hasReceivedEvent) {
          setStreamStatus('ERROR');
          setStreamError(`Timeout: Backend di ${API_BASE_URL} belum merespons stream. Silakan coba tekan "Analisis Ulang".`);
          setIsStreaming(false);
          cleanupConnections();
        }
      }, 15000);

      sseSource.onopen = () => {
        setStreamStatus('STREAMING');
        setStreamError(null);
      };

      // 2. Trigger live backend triage in background
      fetch(`${API_BASE_URL}/api/candidates/${candidateId}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then(async (triageRes) => {
        if (!triageRes.ok) {
          const errJson = await triageRes.json().catch(() => ({}));
          console.warn('Triage POST warning:', errJson);
        }
      }).catch((e) => {
        console.warn('Triage POST failed:', e);
      });

      sseSource.onmessage = (event) => {
        hasReceivedEvent = true;
        clearTimeout(streamWatchdog);

        try {
          const parsed = JSON.parse(event.data);
          const stepKey = parsed.step;
          const stepIdx = STEP_INDEX_MAP[stepKey] !== undefined ? STEP_INDEX_MAP[stepKey] : -1;
          const stepInfo = stepIdx >= 0 ? BACKEND_STEPS[stepIdx] : null;
          const stepTitle = stepInfo ? stepInfo.title : (parsed.step || 'Execution Trace');

          const isFinalStep = (
            stepKey === 'triage_completed' || 
            stepKey === 'triage_failed' || 
            parsed.status === 'failed' || 
            parsed.event === 'failed' ||
            parsed.event === 'completed'
          );
          let triageResult = null;

          if (isFinalStep) {
            const details = parsed.details || {};
            const dimScores = details.dimension_scores || {};
            const round1 = (v) => Math.round(v * 10) / 10;

            // Same four keys as the weight editor and the dossier. This used to
            // emit s_conf/s_risk, where s_conf actually carried EXPERIENCE.
            triageResult = {
              overall_score: details.overall_score !== undefined ? details.overall_score : (parsed.overall_score || 75.0),
              scores_4d: {
                SKILL: round1(dimScores.SKILL ?? 0),
                EXPERIENCE: round1(dimScores.EXPERIENCE ?? 0),
                EDUCATION: round1(dimScores.EDUCATION ?? 0),
                PORTFOLIO: round1(dimScores.PORTFOLIO ?? 0),
              },
              confidence_level: details.confidence_level || null,
              unresolved_risk: details.risk || null,
              recommendation: details.recommendation || parsed.recommendation || 'REVIEW_REQUIRED',
              status: details.status || 'waiting_approval',
              scan_status: 'SCANNED'
            };
          }

          queueRef.current.push({
            time: new Date().toLocaleTimeString('id-ID'),
            stepTitle,
            status: parsed.status ? parsed.status.toUpperCase() : 'INFO',
            details: parsed.details || parsed,
            stepIdx,
            isFinalStep,
            triageResult
          });

          if (!isPlayingRef.current) {
            processNextInQueue();
          }
        } catch (e) {
          console.warn('Non-JSON SSE event received:', event.data);
        }
      };

      sseSource.onerror = (err) => {
        if (isCompletedRef.current) {
          try { sseSource.close(); } catch (e) {}
          return;
        }
        console.error('SSE Error occurred:', err);
        if (!hasReceivedEvent && !isPlayingRef.current) {
          setStreamStatus('ERROR');
          setStreamError('Koneksi ke SSE Broadcaster Backend VPS terputus. Pastikan endpoint stream dapat diakses.');
          setIsStreaming(false);
        }
      };
    } catch (err) {
      console.error('EventSource initialization error:', err);
      setStreamStatus('ERROR');
      setStreamError(err.message);
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (isOpen && candidateId) {
      if (!startedRef.current) {
        startedRef.current = true;
        isCompletedRef.current = false;
        startStream();
      }
    } else if (!isOpen) {
      startedRef.current = false;
      isCompletedRef.current = false;
      cleanupConnections();
    }
  }, [isOpen, candidateId]);

  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="clean-card w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#383a42] bg-primary-slate-1000">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#383a42] flex items-center justify-between bg-[#23252a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-info/20 text-primary-info">
              <Radio className={`w-5 h-5 ${isStreaming ? 'animate-pulse text-primary-info' : 'text-primary-info-border'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Transparansi Proses Kerja AI (Live Trace)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary-info text-white">
                  REAL-TIME SSE
                </span>
                {streamStatus === 'COMPLETED' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-info/20 text-primary-info-border border border-primary-info/30">
                    Selesai &amp; Tersimpan
                  </span>
                )}
                {streamStatus === 'STREAMING' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    Memproses Langsung dari Backend...
                  </span>
                )}
              </div>
              <p className="text-xs text-primary-slate-400 mt-0.5">
                Kandidat: <span className="font-mono text-white font-semibold">{candidate.masked_identifier}</span> • {candidate.job_title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Tutup monitor trace"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Layout: 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          
          {/* Left Column: 7 Canonical Steps Visualizer */}
          <div className="md:col-span-5 bg-primary-slate-100 border-r border-primary-border-200 flex flex-col overflow-y-auto p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-primary-border-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary-slate-600">
                Alur Transparansi 7 Tahap
              </span>
              <span className="text-[10px] font-semibold text-primary-info">
                Deterministik • 0 Halusinasi
              </span>
            </div>

            <div className="space-y-2 flex-1">
              {BACKEND_STEPS.map((step, idx) => {
                const isCompleted = activeStepIndex > idx || streamStatus === 'COMPLETED';
                const isCurrent = activeStepIndex === idx && streamStatus === 'STREAMING';

                return (
                  <div
                    key={step.key}
                    className={`p-3 rounded-xl border transition-all duration-200 ${
                      isCurrent
                        ? 'bg-white border-primary-info shadow-sm ring-2 ring-primary-info/20'
                        : isCompleted
                        ? 'bg-white border-primary-info/30 shadow-2xs'
                        : 'bg-white/60 border-primary-border-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {isCompleted ? (
                            <div className="w-5 h-5 rounded-full bg-primary-info-soft text-primary-info flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-5 h-5 rounded-full bg-primary-info text-white flex items-center justify-center animate-spin">
                              <RotateCcw className="w-3 h-3" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary-border-200 text-primary-slate-600 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${isCurrent ? 'text-primary-info' : isCompleted ? 'text-primary-black' : 'text-primary-slate-600'}`}>
                            {step.title}
                          </div>
                          <div className="text-[11px] text-primary-slate-600 leading-snug mt-0.5">
                            {step.subtitle}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-primary-slate-600 shrink-0">
                        {step.timeTarget}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-primary-border-200">
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary-info shrink-0" />
                <span className="text-[11px] text-primary-info font-medium leading-tight">
                  Kepatuhan UU PDP No. 27/2022 • Seluruh data pribadi disanitasi sebelum evaluasi.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Backend SSE Execution Logs */}
          <div className="md:col-span-7 bg-[#181a1f] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-primary-slate-1000 flex items-center justify-between bg-primary-slate-900">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary-info" />
                <span className="text-xs font-mono font-bold text-white tracking-wide">
                  &gt;_ Log Eksekusi Real-Time SSE Backend
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  streamStatus === 'STREAMING' ? 'bg-amber-400 animate-ping' : 
                  streamStatus === 'COMPLETED' ? 'bg-primary-info' : 'bg-rose-500'
                }`} />
                <span className="text-[10px] font-mono font-bold text-primary-slate-400">
                  {streamStatus}
                </span>
              </div>
            </div>

            {/* Error Notice if any */}
            {streamError && (
              <div className="p-3 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{streamError}</span>
              </div>
            )}

            {/* Terminal Body */}
            <div 
              ref={logContainerRef}
              className="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-3.5 bg-[#121418]"
            >
              {events.length === 0 && streamStatus === 'CONNECTING' && (
                <div className="text-primary-slate-600 italic py-8 text-center space-y-2">
                  <RotateCcw className="w-5 h-5 animate-spin mx-auto text-primary-info" />
                  <div>Menghubungkan ke SSE stream candidate #{candidate?.id}...</div>
                  <div className="text-[10px] text-primary-slate-600">Endpoint: {API_BASE_URL}/api/candidates/{candidate?.id}/trace-stream (tiket sekali pakai)</div>
                </div>
              )}

              {events.map((evt, idx) => {
                const details = (typeof evt.details === 'object' && evt.details !== null) ? evt.details : null;
                const hasThought = Boolean(details?.ai_thought);
                const hasAction = Boolean(details?.backend_action);
                const extractedSkills = Array.isArray(details?.extracted_skills) ? details.extracted_skills : null;
                const dimScores = details?.dimension_scores;

                return (
                  <div 
                    key={idx} 
                    className="p-3.5 rounded-xl border border-slate-800 bg-[#171920] transition-all shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-800/80">
                      <span className="text-primary-info font-bold flex items-center gap-1.5 font-mono">
                        <span className={`w-2 h-2 rounded-full ${evt.status === 'COMPLETED' ? 'bg-emerald-400' : evt.status === 'SKIPPED_NON_TECH' ? 'bg-slate-400' : 'bg-primary-orange animate-pulse'}`} />
                        {evt.step}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          evt.status === 'COMPLETED' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' :
                          evt.status === 'SKIPPED_NON_TECH' ? 'bg-slate-800 text-slate-300' :
                          'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                        }`}>
                          {evt.status}
                        </span>
                        <span className="text-slate-500 text-[10px]">{evt.time}</span>
                      </div>
                    </div>

                    {/* Alur Berpikir AI */}
                    {hasThought && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-100 text-xs font-sans">
                        <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1 text-[11px] uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                          <span>Alur Penalaran AI (AI Thought)</span>
                        </div>
                        <p className="leading-relaxed text-slate-100 text-[11.5px] font-medium">
                          {details.ai_thought}
                        </p>
                      </div>
                    )}

                    {/* Tindakan Backend Server */}
                    {hasAction && (
                      <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/25 text-blue-200 text-[11px] flex items-start gap-2">
                        <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="font-sans leading-relaxed">
                          <span className="font-semibold text-blue-400 font-mono">Proses Server: </span>
                          <span className="text-slate-300">{details.backend_action}</span>
                        </div>
                      </div>
                    )}

                    {/* Kompetensi yang Terdeteksi */}
                    {extractedSkills && extractedSkills.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-slate-400 font-sans font-semibold">Kompetensi Terekstraksi:</span>
                        {extractedSkills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-200 border border-slate-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Skor 4 Dimensi */}
                    {dimScores && (
                      <div className="pt-1 grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
                        <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                          <span className="text-[9px] text-slate-400 block font-sans">Keahlian (40%)</span>
                          <span className="font-bold text-white">{dimScores.SKILL}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                          <span className="text-[9px] text-slate-400 block font-sans">Pengalaman (30%)</span>
                          <span className="font-bold text-white">{dimScores.EXPERIENCE}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                          <span className="text-[9px] text-slate-400 block font-sans">Pendidikan (10%)</span>
                          <span className="font-bold text-white">{dimScores.EDUCATION}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                          <span className="text-[9px] text-slate-400 block font-sans">Portofolio (20%)</span>
                          <span className="font-bold text-white">{dimScores.PORTFOLIO}</span>
                        </div>
                      </div>
                    )}

                    {/* Collapsible raw data payload */}
                    {details && (
                      <details className="mt-1 pt-1 border-t border-slate-800/40 group">
                        <summary className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer select-none font-mono flex items-center gap-1">
                          <span>Detail Teknis Payload JSON</span>
                        </summary>
                        <pre className="mt-1.5 p-2 rounded bg-black/60 text-[10px] text-slate-400 whitespace-pre-wrap break-all overflow-x-auto border border-slate-900 leading-relaxed font-mono">
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      </details>
                    )}

                    {!details && (
                      <pre className="text-slate-300 text-[11px] whitespace-pre-wrap break-all overflow-x-auto leading-relaxed font-mono">
                        {String(evt.details)}
                      </pre>
                    )}
                  </div>
                );
              })}

              {streamStatus === 'COMPLETED' && (
                <div className="p-3 rounded-lg border border-primary-info/30 bg-primary-info/10 text-primary-info-border text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-primary-info" />
                  <span>Proses penyaringan otomatis selesai secara deterministik. Hasil telah disinkronkan ke basis data.</span>
                </div>
              )}
            </div>

            {/* Terminal Status Footer */}
            <div className="px-5 py-2.5 border-t border-primary-slate-1000 bg-[#1a1c22] flex items-center justify-between text-[10px] text-primary-slate-400 font-mono">
              <span>Metode: FastAPI Real-Time SSE Broadcaster</span>
              <span>Candidate ID: {candidate?.id}</span>
              <span>Kepatuhan: UU PDP No. 27/2022</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#383a42] bg-[#23252a] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-primary-slate-400">
            <Sparkles className="w-4 h-4 text-primary-info" />
            <span>Riwayat keputusan AI tersimpan transparan untuk proses audit rekrutmen.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-primary-info hover:bg-primary-info-dark text-white text-xs font-bold transition-all shadow-xs"
          >
            Tutup Monitor
          </button>
        </div>

      </div>
    </div>
  );
}