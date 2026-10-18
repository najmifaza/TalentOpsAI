import React, { useState } from 'react';
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
  Radio
} from 'lucide-react';

export default function DashboardOverview() {
  const [candidates] = useState(MOCK_CANDIDATES);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [traceCandidate, setTraceCandidate] = useState(null);

  const strongMatches = candidates.filter(c => c.recommendation === 'STRONG_MATCH').length;
  const reviewRequired = candidates.filter(c => c.recommendation === 'REVIEW_REQUIRED').length;

  return (
    <div className="space-y-6">
      {/* Top 3 KPI Metric Cards (Inspired by Row 1 in Reference Image) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="clean-card clean-card-hover p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#6C837C] tracking-wide">
              Core Competency Index
            </span>
            <div className="text-2xl font-extrabold text-[#0B201B] tracking-tight">
              88.45 <span className="text-xs font-medium text-[#6C837C]">/100</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
              <span>▲ 4.2%</span>
              <span className="text-[#6C837C] font-normal">vs standar industri</span>
            </div>
          </div>
          {/* Mini Bar Chart Graphic */}
          <div className="flex items-end gap-1 h-10 px-2 py-1 bg-[#EEF4F0] rounded-xl">
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-4"></span>
            <span className="w-1.5 bg-[#235347] rounded-full h-8"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-5"></span>
            <span className="w-1.5 bg-[#10B981] rounded-full h-9"></span>
            <span className="w-1.5 bg-[#235347] rounded-full h-7"></span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="clean-card clean-card-hover p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#6C837C] tracking-wide">
              Determinism & Fairness
            </span>
            <div className="text-2xl font-extrabold text-[#0B201B] tracking-tight">
              99.20 <span className="text-xs font-medium text-[#6C837C]">/100%</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
              <span>▲ 0.8%</span>
              <span className="text-[#6C837C] font-normal">zero demographic bias</span>
            </div>
          </div>
          {/* Mini Bar Chart Graphic */}
          <div className="flex items-end gap-1 h-10 px-2 py-1 bg-[#EEF4F0] rounded-xl">
            <span className="w-1.5 bg-[#DAF1DE] rounded-full h-3"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-6"></span>
            <span className="w-1.5 bg-[#235347] rounded-full h-10"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-7"></span>
            <span className="w-1.5 bg-[#10B981] rounded-full h-9"></span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="clean-card clean-card-hover p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#6C837C] tracking-wide">
              UU PDP Privacy Compliance
            </span>
            <div className="text-2xl font-extrabold text-[#0B201B] tracking-tight">
              100% <span className="text-xs font-medium text-[#6C837C]">AES-256</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
              <span>★ Verified</span>
              <span className="text-[#6C837C] font-normal">zero PII leakage</span>
            </div>
          </div>
          {/* Mini Bar Chart Graphic */}
          <div className="flex items-end gap-1 h-10 px-2 py-1 bg-[#EEF4F0] rounded-xl">
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-5"></span>
            <span className="w-1.5 bg-[#8EB69B] rounded-full h-7"></span>
            <span className="w-1.5 bg-[#235347] rounded-full h-9"></span>
            <span className="w-1.5 bg-[#10B981] rounded-full h-10"></span>
            <span className="w-1.5 bg-[#235347] rounded-full h-8"></span>
          </div>
        </div>
      </div>

      {/* Row 2: Gauge + 4D Distribution + Queue Summary (Responsive for Tablet & Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* Semi-Circle Gauge Card */}
        <div className="md:col-span-1 lg:col-span-3 clean-card p-6 flex flex-col justify-between text-center">
          <div>
            <span className="text-xs font-semibold text-[#6C837C] block mb-2">
              Average Match Rate
            </span>
            <div className="text-4xl font-extrabold text-[#0B201B]">
              76.5%
            </div>
          </div>

          {/* Semi-circular visual */}
          <div className="relative w-36 h-20 mx-auto my-3 overflow-hidden">
            <svg viewBox="0 0 100 50" className="w-full h-full">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#E1EBE4"
                strokeWidth="10"
                strokeLinecap="round"
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

          <div className="text-[11px] text-[#6C837C] font-medium">
            Cut-off Minimum: <strong className="text-[#0B201B]">75.0%</strong>
          </div>
        </div>

        {/* 4D Dimension Distribution Card */}
        <div className="md:col-span-1 lg:col-span-4 clean-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#6C837C]">
                4D Scoring Dimensions
              </span>
              <span className="text-lg font-bold text-[#0B201B]">86.2%</span>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E]">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                  <span>S_comp (Keahlian Inti)</span>
                </span>
                <span className="font-semibold text-[#0B201B]">88%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E]">
                  <span className="w-2 h-2 rounded-full bg-[#235347]"></span>
                  <span>S_port (Repositori GitHub)</span>
                </span>
                <span className="font-semibold text-[#0B201B]">82%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E]">
                  <span className="w-2 h-2 rounded-full bg-[#8EB69B]"></span>
                  <span>S_conf (Keyakinan Bukti)</span>
                </span>
                <span className="font-semibold text-[#0B201B]">91%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#3D544E]">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>S_risk (Penalti Anomali)</span>
                </span>
                <span className="font-semibold text-[#0B201B]">18%</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => alert('Detail kalkulasi deterministik 4D PRD Bab 5.1')}
            className="w-full mt-4 py-2 px-3 bg-[#EEF4F0] hover:bg-[#E1EBE4] text-[#0B2B26] text-xs font-semibold rounded-xl border border-[#E1EBE4] transition-colors"
          >
            Lihat Formula Matematis
          </button>
        </div>

        {/* Queue Distribution Breakdown */}
        <div className="md:col-span-2 lg:col-span-5 clean-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#0B201B]">Distribusi Antrean Triage</h4>
                <p className="text-[11px] text-[#6C837C]">Batch 1 Golden Dataset (5 Kandidat)</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#DAF1DE] text-[#0B2B26] text-xs font-bold border border-[#C2E0C4]">
                5 Active
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] border border-[#E1EBE4]">
                <div className="text-[11px] text-[#6C837C]">Strong Match</div>
                <div className="text-base font-extrabold text-[#10B981] mt-0.5">2 (40%)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] border border-[#E1EBE4]">
                <div className="text-[11px] text-[#6C837C]">Review Required</div>
                <div className="text-base font-extrabold text-amber-600 mt-0.5">1 (20%)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] border border-[#E1EBE4]">
                <div className="text-[11px] text-[#6C837C]">Weak Fit</div>
                <div className="text-base font-extrabold text-[#3D544E] mt-0.5">1 (20%)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F6FAF7] border border-[#E1EBE4]">
                <div className="text-[11px] text-[#6C837C]">Security Quarantine</div>
                <div className="text-base font-extrabold text-rose-600 mt-0.5">1 (20%)</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#6C837C] mt-3 flex items-center justify-between pt-2 border-t border-[#E1EBE4]">
            <span>Audit GitHub IT: <strong className="text-[#0B201B]">3 Terverifikasi</strong></span>
            <span>Non-IT: <strong className="text-[#0B201B]">1 N/A</strong></span>
          </div>
        </div>
      </div>

      {/* Row 3: 2 Pill Cards + Forest Feature Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* Dark Pill Card */}
        <div className="md:col-span-1 lg:col-span-3 bg-[#0B2B26] text-white rounded-3xl p-5 flex items-center gap-4 shadow-md">
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
          <div className="w-12 h-12 rounded-full border-2 border-[#10B981] flex items-center justify-center font-bold text-xs text-[#0B2B26] shrink-0 bg-[#DAF1DE]/60">
            5.7ms
          </div>
          <div className="min-w-0">
            <h5 className="text-xs font-bold text-[#0B201B] truncate">Live Backend Latency</h5>
            <p className="text-[10px] text-[#6C837C] leading-tight mt-0.5">
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
            <h3 className="text-lg font-bold text-[#0B201B]">Daftar Antrean Seleksi Kandidat</h3>
            <p className="text-xs text-[#6C837C]">
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
