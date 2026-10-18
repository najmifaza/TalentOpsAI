import React, { useState, useEffect, useCallback } from 'react';
import CandidateTable from './CandidateTable';
import CandidateModal from './CandidateModal';
import AgentTraceModal from './AgentTraceModal';
import { MOCK_CANDIDATES } from '../data/mockCandidates';
import { 
  Users, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Server,
  Database,
  ArrowUpRight,
  Sparkles,
  Cpu,
  Layers,
  ArrowRight,
  Radio,
  RefreshCw
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

export default function DashboardOverview() {
  const [candidates, setCandidates] = useState(MOCK_CANDIDATES);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [traceCandidate, setTraceCandidate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/candidates?limit=50`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const mapped = json.data.map(c => {
            const match = MOCK_CANDIDATES.find(
              m => m.masked_identifier === c.masked_identifier || m.id === c.id
            );
            const dims = c.dimension_scores || {};
            return {
              id: c.id,
              masked_identifier: c.masked_identifier,
              tracking_token: match?.tracking_token || `tk-${c.id}`,
              job_title: match?.job_title || 'Senior Backend Engineer',
              applied_date: c.created_at ? c.created_at.replace('T', ' ').slice(0, 16) : (match?.applied_date || '2026-10-18 10:00'),
              candidate_name_masked: match?.candidate_name_masked || 'K******** *******',
              overall_score: c.overall_score !== null ? c.overall_score : (match?.overall_score || 0),
              scores_4d: {
                s_comp: dims.SKILL || match?.scores_4d?.s_comp || 0,
                s_port: dims.PORTFOLIO || match?.scores_4d?.s_port || 0,
                s_conf: dims.EDUCATION || (c.confidence_level === 'HIGH' ? 95 : 75),
                s_risk: c.unresolved_risk === 'HIGH' ? 70 : (c.unresolved_risk === 'MEDIUM' ? 35 : 10),
              },
              recommendation: c.recommendation || match?.recommendation || 'REVIEW_REQUIRED',
              status: c.status || 'queued',
              confidence_level: c.confidence_level || 'MEDIUM',
              verified_github: match?.verified_github || null,
              github_status: match?.github_status || 'VERIFIED',
              flags: match?.flags || [],
              key_technologies: match?.key_technologies || ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
            };
          });
          setCandidates(mapped);
          setIsLiveConnected(true);
        }
      }
    } catch (err) {
      console.warn('Backend candidates fetch fallback to pre-cached fixtures:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const strongMatches = candidates.filter(c => c.recommendation === 'STRONG_MATCH').length;
  const reviewRequired = candidates.filter(c => c.recommendation === 'REVIEW_REQUIRED').length;

  return (
    <div className="space-y-6">
      {/* Top 3 KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="clean-card clean-card-hover p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#6C837C] dark:text-[#8EB69B] tracking-wide">
              Core Competency Index
            </span>
            <div className="text-2xl font-extrabold text-[#0B201B] dark:text-[#DAF1DE] tracking-tight">
              88.45 <span className="text-xs font-medium text-[#6C837C] dark:text-[#8EB69B]/70">/100</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
              <span>▲ 4.2%</span>
              <span className="text-[#6C837C] dark:text-[#8EB69B]/70 font-normal">vs standar industri</span>
            </div>
          </div>
          {/* Mini Bar Chart Graphic */}
          <div className="flex items-end gap-1 h-10 px-2 py-1 bg-[#EEF4F0] dark:bg-[#072421] rounded-xl border border-transparent dark:border-[#163832]">
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-4"></span>
            <span className="w-1.5 bg-[#235347] dark:bg-[#8EB69B] rounded-full h-8"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-5"></span>
            <span className="w-1.5 bg-[#10B981] rounded-full h-9"></span>
            <span className="w-1.5 bg-[#235347] dark:bg-[#8EB69B] rounded-full h-7"></span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="clean-card clean-card-hover p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#6C837C] dark:text-[#8EB69B] tracking-wide">
              Determinism & Fairness
            </span>
            <div className="text-2xl font-extrabold text-[#0B201B] dark:text-[#DAF1DE] tracking-tight">
              99.20 <span className="text-xs font-medium text-[#6C837C] dark:text-[#8EB69B]/70">/100%</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
              <span>▲ 0.8%</span>
              <span className="text-[#6C837C] dark:text-[#8EB69B]/70 font-normal">zero demographic bias</span>
            </div>
          </div>
          {/* Mini Bar Chart Graphic */}
          <div className="flex items-end gap-1 h-10 px-2 py-1 bg-[#EEF4F0] dark:bg-[#072421] rounded-xl border border-transparent dark:border-[#163832]">
            <span className="w-1.5 bg-[#DAF1DE] dark:bg-[#163832] rounded-full h-3"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-6"></span>
            <span className="w-1.5 bg-[#235347] dark:bg-[#8EB69B] rounded-full h-10"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-7"></span>
            <span className="w-1.5 bg-[#10B981] rounded-full h-9"></span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="clean-card clean-card-hover p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#6C837C] dark:text-[#8EB69B] tracking-wide">
              UU PDP Privacy Compliance
            </span>
            <div className="text-2xl font-extrabold text-[#0B201B] dark:text-[#DAF1DE] tracking-tight">
              100% <span className="text-xs font-medium text-[#6C837C] dark:text-[#8EB69B]/70">AES-256</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
              <span>★ Verified</span>
              <span className="text-[#6C837C] dark:text-[#8EB69B]/70 font-normal">zero PII leakage</span>
            </div>
          </div>
          {/* Mini Bar Chart Graphic */}
          <div className="flex items-end gap-1 h-10 px-2 py-1 bg-[#EEF4F0] dark:bg-[#072421] rounded-xl border border-transparent dark:border-[#163832]">
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-5"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-7"></span>
            <span className="w-1.5 bg-[#235347] dark:bg-[#8EB69B] rounded-full h-9"></span>
            <span className="w-1.5 bg-[#10B981] rounded-full h-10"></span>
            <span className="w-1.5 bg-[#235347] dark:bg-[#8EB69B] rounded-full h-8"></span>
          </div>
        </div>
      </div>

      {/* Row 2: Gauge + 4D Distribution + Queue Summary (Responsive for Tablet & Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* Semi-Circle Gauge Card */}
        <div className="md:col-span-1 lg:col-span-3 clean-card p-6 flex flex-col justify-between text-center">
          <div>
            <span className="text-xs font-semibold text-[#6C837C] dark:text-[#8EB69B] block mb-2">
              Average Match Rate
            </span>
            <div className="text-4xl font-extrabold text-[#0B201B] dark:text-[#DAF1DE]">
              76.5%
            </div>
          </div>

          {/* Semi-circular visual */}
          <div className="relative w-36 h-20 mx-auto my-3 overflow-hidden">
            <svg viewBox="0 0 100 50" className="w-full h-full">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                className="text-[#E1EBE4] dark:text-[#163832]"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 76 18"
                fill="none"
                stroke="#10B981"
                strokeWidth="10"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="text-[11px] text-[#6C837C] dark:text-[#8EB69B] font-medium">
            Cut-off Minimum: <strong className="text-[#0B201B] dark:text-[#DAF1DE]">75.0%</strong>
          </div>
        </div>

        {/* 4D Dimension Distribution Card */}
        <div className="md:col-span-1 lg:col-span-4 clean-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#6C837C] dark:text-[#8EB69B]">
                4D Scoring Dimensions
              </span>
              <span className="text-lg font-bold text-[#0B201B] dark:text-[#DAF1DE]">86.2%</span>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E] dark:text-[#DAF1DE]">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                  <span>S_comp (Keahlian Inti)</span>
                </span>
                <span className="font-semibold text-[#0B201B] dark:text-[#DAF1DE]">88%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E] dark:text-[#DAF1DE]">
                  <span className="w-2 h-2 rounded-full bg-[#235347] dark:bg-[#8EB69B]"></span>
                  <span>S_port (Repositori GitHub)</span>
                </span>
                <span className="font-semibold text-[#0B201B] dark:text-[#DAF1DE]">82%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E] dark:text-[#DAF1DE]">
                  <span className="w-2 h-2 rounded-full bg-[#8EB69B]"></span>
                  <span>S_conf (Keyakinan Bukti)</span>
                </span>
                <span className="font-semibold text-[#0B201B] dark:text-[#DAF1DE]">91%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E] dark:text-[#DAF1DE]">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>S_risk (Penalti Anomali)</span>
                </span>
                <span className="font-semibold text-[#0B201B] dark:text-[#DAF1DE]">18%</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => alert('Detail kalkulasi deterministik 4D PRD Bab 5.1')}
            className="w-full mt-4 py-2 px-3 bg-[#EEF4F0] hover:bg-[#E1EBE4] text-[#0B2B26] text-xs font-semibold rounded-xl border border-[#E1EBE4] transition-colors btn-interactive"
          >
            Lihat Formula Matematis
          </button>
        </div>

        {/* Queue Distribution Breakdown */}
        <div className="md:col-span-2 lg:col-span-5 clean-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#0B201B] dark:text-[#DAF1DE]">Distribusi Antrean Triage</h4>
                <p className="text-[11px] text-[#6C837C] dark:text-[#8EB69B]">Batch 1 Golden Dataset (5 Kandidat)</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#DAF1DE] dark:bg-[#163832] text-[#0B2B26] dark:text-[#DAF1DE] text-xs font-bold border border-[#C2E0C4] dark:border-[#235347]">
                5 Active
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] dark:bg-[#072421] border border-[#E1EBE4] dark:border-[#163832]">
                <div className="text-[11px] text-[#6C837C] dark:text-[#8EB69B]">Strong Match</div>
                <div className="text-base font-extrabold text-[#10B981] mt-0.5">2 (40%)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] border border-[#E1EBE4]">
                <div className="text-[11px] text-[#6C837C]">Review Required</div>
                <div className="text-base font-extrabold text-amber-500 mt-0.5">1 (20%)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] dark:bg-[#072421] border border-[#E1EBE4] dark:border-[#163832]">
                <div className="text-[11px] text-[#6C837C] dark:text-[#8EB69B]">Weak Fit</div>
                <div className="text-base font-extrabold text-[#3D544E] dark:text-[#8EB69B] mt-0.5">1 (20%)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] border border-[#E1EBE4]">
                <div className="text-[11px] text-[#6C837C]">Security Quarantine</div>
                <div className="text-base font-extrabold text-rose-500 mt-0.5">1 (20%)</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#6C837C] dark:text-[#8EB69B] mt-3 flex items-center justify-between pt-2 border-t border-[#E1EBE4] dark:border-[#163832]">
            <span>Audit GitHub IT: <strong className="text-[#0B201B] dark:text-[#DAF1DE]">3 Terverifikasi</strong></span>
            <span>Non-IT: <strong className="text-[#0B201B] dark:text-[#DAF1DE]">1 N/A</strong></span>
          </div>
        </div>
      </div>

      {/* Row 3: 2 Pill Cards + Forest Feature Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* Dark Pill Card */}
        <div className="md:col-span-1 lg:col-span-3 bg-[#0B2B26] dark:bg-[#072421] border border-transparent dark:border-[#163832] text-white rounded-3xl p-5 flex items-center gap-4 shadow-md">
          <div className="relative w-12 h-12 rounded-full border-2 border-[#8EB69B] flex items-center justify-center font-bold text-sm shrink-0">
            92.4
          </div>
          <div className="min-w-0">
            <h5 className="text-xs font-bold text-white truncate">Autonomous Agent Cycle</h5>
            <p className="text-[10px] text-[#DAF1DE]/70 leading-tight mt-0.5">
              Gemini 3.8 Single-Pass & Bounded Self-Healing
            </p>
          </div>
        </div>

        {/* Light Pill Card */}
        <div className="md:col-span-1 lg:col-span-3 clean-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#10B981] flex items-center justify-center font-bold text-xs text-[#0B2B26] dark:text-[#DAF1DE] shrink-0 bg-[#DAF1DE]/60 dark:bg-[#163832]/60">
            5.7ms
          </div>
          <div className="min-w-0">
            <h5 className="text-xs font-bold text-[#0B201B] dark:text-[#DAF1DE] truncate">Live Backend Latency</h5>
            <p className="text-[10px] text-[#6C837C] dark:text-[#8EB69B] leading-tight mt-0.5">
              Vercel Edge &rarr; VPS MariaDB ACID
            </p>
          </div>
        </div>

        {/* Forest Feature Banner */}
        <div className="md:col-span-2 lg:col-span-6 forest-card p-5 flex items-center justify-between relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8EB69B]/25 text-[#DAF1DE] font-semibold">
                Sprint 1 Walking Skeleton
              </span>
              <span className="text-[10px] text-[#8EB69B]">SDG 8 &bull; UU PDP</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Rekrutmen Beretika, Nondiskriminatif & Otonom
            </h3>
            <p className="text-[11px] text-[#DAF1DE]/80 leading-relaxed">
              Arsitektur terdistribusi live: Frontend Willy terhubung stabil ke backend Najmi & modul AI Fardizza.
            </p>
          </div>

          <div className="relative z-10 shrink-0 ml-4">
            <div className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer border border-white/20">
              <ArrowUpRight className="w-5 h-5 text-[#DAF1DE]" />
            </div>
          </div>
        </div>
      </div>

      {/* Live Autonomous SSE Stream Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0B2B26] via-[#163832] to-[#235347] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg border border-[#163832]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8EB69B]/20 border border-[#8EB69B]/30 flex items-center justify-center text-[#DAF1DE] shrink-0">
            <Radio className="w-5 h-5 text-[#8EB69B] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Live Autonomous Agent Trace Stream</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-mono font-semibold border border-emerald-400/30">
                SSE Active
              </span>
            </div>
            <p className="text-xs text-[#8EB69B]">
              Saksikan penyiaran real-time langkah otonom agen AI (<code className="text-white font-mono">/api/candidates/stream/:id</code>) dari sanitasi PII hingga keputusan akhir deterministik.
            </p>
          </div>
        </div>
        <button
          onClick={() => setTraceCandidate(candidates[0])}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#8EB69B] hover:bg-[#DAF1DE] text-[#051F20] font-bold text-xs shadow-md transition-all duration-200"
        >
          <Radio className="w-4 h-4 text-[#051F20]" />
          <span>Buka Live Trace Monitor</span>
        </button>
      </div>

      {/* Main Table Section: Candidate Queue */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#0B201B] dark:text-[#DAF1DE]">Daftar Antrean Seleksi Kandidat</h3>
            <p className="text-xs text-[#6C837C] dark:text-[#8EB69B]">
              Tampilan dossier anonim terenkripsi dengan rincian scoring multi-dimensi PRD Bab 8.2
            </p>
          </div>
        </div>

        <CandidateTable 
          candidates={candidates} 
          onSelectCandidate={setSelectedCandidate} 
          onStreamCandidate={setTraceCandidate}
        />
      </div>

      {/* Candidate Dossier Detail Modal */}
      {selectedCandidate && (
        <CandidateModal 
          candidate={selectedCandidate} 
          onClose={() => setSelectedCandidate(null)} 
          onRefresh={fetchCandidates}
        />
      )}

      {/* Live Agentic Trace SSE Modal */}
      <AgentTraceModal
        candidate={traceCandidate}
        isOpen={!!traceCandidate}
        onClose={() => setTraceCandidate(null)}
      />
    </div>
  );
}
