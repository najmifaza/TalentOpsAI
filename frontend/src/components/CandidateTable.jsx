import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ExternalLink, 
  ShieldCheck, 
  Filter, 
  Search, 
  ChevronRight,
  Eye,
  Github,
  Zap,
  Info
} from 'lucide-react';

export default function CandidateTable({ candidates, onSelectCandidate }) {
  const [search, setSearch] = useState('');
  const [filterRec, setFilterRec] = useState('ALL');

  const filtered = candidates.filter(c => {
    const matchesSearch = c.masked_identifier.toLowerCase().includes(search.toLowerCase()) ||
                          c.job_title.toLowerCase().includes(search.toLowerCase()) ||
                          c.key_technologies.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesRec = filterRec === 'ALL' || c.recommendation === filterRec;
    return matchesSearch && matchesRec;
  });

  const getScoreBadge = (score) => {
    if (score >= 85) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    } else if (score >= 60) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    } else {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    }
  };

  const getRecBadge = (rec) => {
    switch (rec) {
      case 'STRONG_MATCH':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: CheckCircle2,
          label: 'Strong Match'
        };
      case 'REVIEW_REQUIRED':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: AlertTriangle,
          label: 'Review Required'
        };
      case 'WEAK_FIT':
        return {
          bg: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
          icon: Info,
          label: 'Weak Fit'
        };
      case 'SECURITY_QUARANTINE':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: XCircle,
          label: 'Quarantine'
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: Info,
          label: rec
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-panel">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari token, posisi, atau keahlian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Filter:</span>
          <select
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
            className="bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500/60"
          >
            <option value="ALL">Semua Rekomendasi ({candidates.length})</option>
            <option value="STRONG_MATCH">Strong Match</option>
            <option value="REVIEW_REQUIRED">Review Required</option>
            <option value="WEAK_FIT">Weak Fit</option>
            <option value="SECURITY_QUARANTINE">Security Quarantine</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl glass-panel overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Kandidat (Anonim UU PDP)</th>
                <th className="py-3.5 px-4">Posisi & Waktu Lamaran</th>
                <th className="py-3.5 px-4 text-center">Skor 4D</th>
                <th className="py-3.5 px-4">Rekomendasi AI</th>
                <th className="py-3.5 px-4">Audit GitHub</th>
                <th className="py-3.5 px-4">Keahlian Kunci</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((candidate) => {
                const recInfo = getRecBadge(candidate.recommendation);
                const RecIcon = recInfo.icon;

                return (
                  <tr 
                    key={candidate.id} 
                    className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onClick={() => onSelectCandidate(candidate)}
                  >
                    {/* Identifier */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center font-mono text-cyan-400 font-semibold text-xs">
                          {candidate.id}
                        </div>
                        <div>
                          <div className="font-mono font-semibold text-slate-200 text-xs">
                            {candidate.masked_identifier}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {candidate.candidate_name_masked}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-200">{candidate.job_title}</div>
                      <div className="text-[11px] text-slate-400">{candidate.applied_date}</div>
                    </td>

                    {/* 4D Overall Score */}
                    <td className="py-4 px-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs border ${getScoreBadge(candidate.overall_score)}`}>
                        <Zap className="w-3 h-3" />
                        <span>{candidate.overall_score.toFixed(1)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Comp: {candidate.scores_4d.s_comp} | Risk: {candidate.scores_4d.s_risk}
                      </div>
                    </td>

                    {/* Recommendation */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${recInfo.bg}`}>
                        <RecIcon className="w-3.5 h-3.5" />
                        <span>{recInfo.label}</span>
                      </span>
                      {candidate.flags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {candidate.flags.map((flag, idx) => (
                            <span key={idx} className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono">
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* GitHub Audit */}
                    <td className="py-4 px-4">
                      {candidate.github_status === 'VERIFIED' ? (
                        <a 
                          href={candidate.verified_github} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Github className="w-3.5 h-3.5" />
                          <span className="font-mono text-[11px]">Verified</span>
                          <ExternalLink className="w-3 h-3 text-emerald-400/70" />
                        </a>
                      ) : candidate.github_status === 'NOT_APPLICABLE' ? (
                        <span className="text-[11px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                          N/A (Non-IT)
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          Audit Failed
                        </span>
                      )}
                    </td>

                    {/* Technologies */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {candidate.key_technologies.slice(0, 3).map((tech, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
                            {tech}
                          </span>
                        ))}
                        {candidate.key_technologies.length > 3 && (
                          <span className="text-[10px] text-slate-400 px-1 py-0.5">
                            +{candidate.key_technologies.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCandidate(candidate);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-400 transition-colors"
                        title="Lihat Rincian Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
