import React, { useState } from 'react';
import CandidateTable from './CandidateTable';
import CandidateModal from './CandidateModal';
import { MOCK_CANDIDATES } from '../data/mockCandidates';
import { 
  Users, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Server,
  Database,
  ArrowUpRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

export default function DashboardOverview() {
  const [candidates] = useState(MOCK_CANDIDATES);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const strongMatches = candidates.filter(c => c.recommendation === 'STRONG_MATCH').length;
  const reviewRequired = candidates.filter(c => c.recommendation === 'REVIEW_REQUIRED').length;

  return (
    <div className="space-y-6">
      {/* Walking Skeleton Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-indigo-950/20 border border-cyan-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-cyan-500/5 to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Sprint 1 Walking Skeleton — Active & Live
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              Pipeline Integrasi End-to-End: Vercel Client &rarr; VPS Backend &rarr; MariaDB
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Arsitektur terdistribusi berjalan dengan sukses. Request frontend terhubung langsung ke backend FastAPI live di VPS Linux 
              (<code className="text-cyan-300 font-mono">https://api-talentops.fawt.biz.id</code>) dengan enkripsi data ACID.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center gap-2 font-mono">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>FastAPI 2.5.2</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center gap-2 font-mono">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>MariaDB 12-Table</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-4 rounded-xl glass-panel glass-panel-hover space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Kandidat Aktif</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{candidates.length}</span>
            <span className="text-[11px] text-cyan-400 font-medium">Batch 1 Golden Dataset</span>
          </div>
          <p className="text-[11px] text-slate-400">5 profil sintetis terstandarisasi PRD</p>
        </div>

        {/* Card 2 */}
        <div className="p-4 rounded-xl glass-panel glass-panel-hover space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Strong Match Ratio</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">
              {Math.round((strongMatches / candidates.length) * 100)}%
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">
              ({strongMatches} Kandidat)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Ambang batas deterministik &ge; 85.0</p>
        </div>

        {/* Card 3 */}
        <div className="p-4 rounded-xl glass-panel glass-panel-hover space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Review & Anomali</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{reviewRequired}</span>
            <span className="text-[11px] text-amber-400 font-medium">Memerlukan HR</span>
          </div>
          <p className="text-[11px] text-slate-400">Deteksi overlap tanggal & mitigasi risiko</p>
        </div>

        {/* Card 4 */}
        <div className="p-4 rounded-xl glass-panel glass-panel-hover space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Kepatuhan UU PDP No. 27</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-400">100%</span>
            <span className="text-[11px] text-cyan-400 font-medium">AES-256-GCM</span>
          </div>
          <p className="text-[11px] text-slate-400">Masked PII & local envelope encryption</p>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Antrean Triage Kandidat</h3>
            <p className="text-xs text-slate-400">
              Daftar pelamar terenkripsi dengan evaluasi multi-dimensi AI Agent Gemini 3.8
            </p>
          </div>
        </div>

        <CandidateTable 
          candidates={candidates} 
          onSelectCandidate={setSelectedCandidate} 
        />
      </div>

      {/* Modal */}
      {selectedCandidate && (
        <CandidateModal 
          candidate={selectedCandidate} 
          onClose={() => setSelectedCandidate(null)} 
        />
      )}
    </div>
  );
}
