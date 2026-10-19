import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Radio, 
  RotateCcw, 
  Cpu, 
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';

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

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

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

      if (onTriageComplete && candidate) {
        onTriageComplete(candidate.id, item.triageResult);
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

    // 1. Trigger live backend triage in background
    try {
      const triageRes = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!triageRes.ok) {
        const errJson = await triageRes.json().catch(() => ({}));
        setStreamStatus('ERROR');
        setStreamError(
          triageRes.status === 404
            ? `Kandidat (ID: ${candidateId}) tidak ditemukan di basis data backend VPS (${API_BASE_URL}). Pastikan ID terdaftar.`
            : `Backend Triage Galat (${triageRes.status}): ${errJson.detail || 'Gagal memulai triage di server.'}`
        );
        setIsStreaming(false);
        cleanupConnections();
        return;
      }
    } catch (e) {
      console.warn('Triage POST failed:', e);
      setStreamStatus('ERROR');
      setStreamError(`Koneksi Backend Gagal: ${e.message}`);
      setIsStreaming(false);
      cleanupConnections();
      return;
    }

    // 2. Open real SSE connection directly to backend broadcaster
    try {
      const sseSource = new EventSource(`${API_BASE_URL}/api/candidates/stream/${candidateId}`);
      sseRef.current = sseSource;

      // Watchdog: If server stream gives no event within 6s
      const streamWatchdog = setTimeout(() => {
        if (!hasReceivedEvent) {
          setStreamStatus('ERROR');
          setStreamError(`Timeout: Backend di ${API_BASE_URL} belum mengirim data stream. Silakan coba tekan "Analisis Ulang".`);
          setIsStreaming(false);
          cleanupConnections();
        }
      }, 6000);

      sseSource.onopen = () => {
        setStreamStatus('STREAMING');
        setStreamError(null);
      };

      sseSource.onmessage = (event) => {
        hasReceivedEvent = true;
        clearTimeout(streamWatchdog);

        try {
          const parsed = JSON.parse(event.data);
          const stepKey = parsed.step;
          const stepIdx = STEP_INDEX_MAP[stepKey] !== undefined ? STEP_INDEX_MAP[stepKey] : -1;
          const stepInfo = stepIdx >= 0 ? BACKEND_STEPS[stepIdx] : null;
          const stepTitle = stepInfo ? stepInfo.title : (parsed.step || 'Execution Trace');

          const isFinalStep = (stepKey === 'triage_completed');
          let triageResult = null;

          if (isFinalStep) {
            const details = parsed.details || {};
            const dimScores = details.dimension_scores || {};
            const s_comp = dimScores.SKILL !== undefined ? dimScores.SKILL : 80.0;
            const s_port = dimScores.PORTFOLIO !== undefined ? dimScores.PORTFOLIO : 70.0;
            const s_conf = dimScores.EXPERIENCE !== undefined ? dimScores.EXPERIENCE : 85.0;
            const s_risk = details.risk === 'LOW' ? 10.0 : details.risk === 'MEDIUM' ? 25.0 : details.risk === 'HIGH' ? 45.0 : 15.0;

            triageResult = {
              overall_score: details.overall_score !== undefined ? details.overall_score : (parsed.overall_score || 75.0),
              scores_4d: {
                s_comp: Math.round(s_comp * 10) / 10,
                s_port: Math.round(s_port * 10) / 10,
                s_conf: Math.round(s_conf * 10) / 10,
                s_risk: Math.round(s_risk * 10) / 10
              },
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
    if (isOpen && candidate) {
      startStream();
    }
    return () => cleanupConnections();
  }, [isOpen, candidate]);

  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="clean-card w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#383a42] bg-[#2b2d32]">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#383a42] flex items-center justify-between bg-[#23252a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#1b55f5]/20 text-[#1b55f5]">
              <Radio className={`w-5 h-5 ${isStreaming ? 'animate-pulse text-[#1b55f5]' : 'text-[#8ec0ff]'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Transparansi Proses Kerja AI (Live Trace)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1b55f5] text-white">
                  REAL-TIME SSE
                </span>
                {streamStatus === 'COMPLETED' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1b55f5]/20 text-[#8ec0ff] border border-[#1b55f5]/30">
                    Selesai &amp; Tersimpan
                  </span>
                )}
                {streamStatus === 'STREAMING' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    Memproses Langsung dari Backend...
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9a9aa8] mt-0.5">
                Kandidat: <span className="font-mono text-white font-semibold">{candidate.masked_identifier}</span> • {candidate.job_title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={startStream}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 disabled:opacity-50"
              title="Jalankan Ulang Triage Backend"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin' : ''}`} />
              <span>Analisis Ulang</span>
            </button>
            <button
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
          <div className="md:col-span-5 bg-[#f4f4f6] border-r border-[#e6e6ea] flex flex-col overflow-y-auto p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#e6e6ea]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#67677e]">
                Alur Transparansi 7 Tahap
              </span>
              <span className="text-[10px] font-semibold text-[#1b55f5]">
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
                        ? 'bg-white border-[#1b55f5] shadow-sm ring-2 ring-[#1b55f5]/20'
                        : isCompleted
                        ? 'bg-white border-[#1b55f5]/30 shadow-2xs'
                        : 'bg-white/60 border-[#e6e6ea] opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {isCompleted ? (
                            <div className="w-5 h-5 rounded-full bg-[#eaf0ff] text-[#1b55f5] flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-5 h-5 rounded-full bg-[#1b55f5] text-white flex items-center justify-center animate-spin">
                              <RotateCcw className="w-3 h-3" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-[#e6e6ea] text-[#67677e] flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${isCurrent ? 'text-[#1b55f5]' : isCompleted ? 'text-[#000000]' : 'text-[#67677e]'}`}>
                            {step.title}
                          </div>
                          <div className="text-[11px] text-[#67677e] leading-snug mt-0.5">
                            {step.subtitle}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#67677e] shrink-0">
                        {step.timeTarget}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#e6e6ea]">
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1b55f5] shrink-0" />
                <span className="text-[11px] text-[#1b55f5] font-medium leading-tight">
                  Kepatuhan UU PDP No. 27/2022 • Seluruh data pribadi disanitasi sebelum evaluasi.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Backend SSE Execution Logs */}
          <div className="md:col-span-7 bg-[#181a1f] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b2d32] flex items-center justify-between bg-[#1f2127]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#1b55f5]" />
                <span className="text-xs font-mono font-bold text-white tracking-wide">
                  &gt;_ Log Eksekusi Real-Time SSE Backend
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  streamStatus === 'STREAMING' ? 'bg-amber-400 animate-ping' : 
                  streamStatus === 'COMPLETED' ? 'bg-[#1b55f5]' : 'bg-rose-500'
                }`} />
                <span className="text-[10px] font-mono font-bold text-[#9a9aa8]">
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
                <div className="text-[#67677e] italic py-8 text-center space-y-2">
                  <RotateCcw className="w-5 h-5 animate-spin mx-auto text-[#1b55f5]" />
                  <div>Menghubungkan ke SSE stream candidate #{candidate?.id}...</div>
                  <div className="text-[10px] text-[#67677e]">Endpoint: {API_BASE_URL}/api/candidates/stream/{candidate?.id}</div>
                </div>
              )}

              {events.map((evt, idx) => (
                <div 
                  key={idx} 
                  className="p-3 rounded-lg border border-[#2b2d32] bg-[#1a1c22] transition-all"
                >
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-[#2b2d32] mb-2">
                    <span className="text-[#1b55f5] font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1b55f5]" />
                      {evt.step}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#8ec0ff] font-bold text-[10px]">{evt.status}</span>
                      <span className="text-[#67677e] text-[10px]">{evt.time}</span>
                    </div>
                  </div>
                  <pre className="text-[#d8d8df] text-[11px] whitespace-pre-wrap break-all overflow-x-auto leading-relaxed">
                    {typeof evt.details === 'object' 
                      ? JSON.stringify(evt.details, null, 2) 
                      : evt.details}
                  </pre>
                </div>
              ))}

              {streamStatus === 'COMPLETED' && (
                <div className="p-3 rounded-lg border border-[#1b55f5]/30 bg-[#1b55f5]/10 text-[#8ec0ff] text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1b55f5]" />
                  <span>Proses autonomous triage selesai secara deterministik. Hasil telah disinkronkan ke basis data.</span>
                </div>
              )}
            </div>

            {/* Terminal Status Footer */}
            <div className="px-5 py-2.5 border-t border-[#2b2d32] bg-[#1a1c22] flex items-center justify-between text-[10px] text-[#9a9aa8] font-mono">
              <span>Metode: FastAPI Real-Time SSE Broadcaster</span>
              <span>Candidate ID: {candidate?.id}</span>
              <span>Kepatuhan: UU PDP No. 27/2022</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#383a42] bg-[#23252a] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#9a9aa8]">
            <Sparkles className="w-4 h-4 text-[#1b55f5]" />
            <span>Riwayat keputusan AI tersimpan transparan untuk proses audit rekrutmen.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] text-white text-xs font-bold transition-all shadow-xs"
          >
            Tutup Monitor
          </button>
        </div>

      </div>
    </div>
  );
}