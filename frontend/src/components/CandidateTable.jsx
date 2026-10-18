import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ExternalLink, 
  Filter, 
  Search, 
  Eye,
  Github,
  Zap,
  Info,
  Radio
} from 'lucide-react';

export default function CandidateTable({ candidates, onSelectCandidate, onStreamCandidate }) {
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
      return 'bg-[#DAF1DE] text-[#0B2B26] border-[#C2E0C4]';
    } else if (score >= 60) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    } else {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
  };

  const getRecBadge = (rec) => {
    switch (rec) {
      case 'STRONG_MATCH':
        return {
          bg: 'bg-[#DAF1DE] text-[#0B2B26] border-[#C2E0C4]',
          icon: CheckCircle2,
          label: 'Strong Match'
        };
      case 'REVIEW_REQUIRED':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: AlertTriangle,
          label: 'Review Required'
        };
      case 'WEAK_FIT':
        return {
          bg: 'bg-[#EEF4F0] dark:bg-[#072421] text-[#3D544E] dark:text-[#8EB69B] border-[#E1EBE4] dark:border-[#163832]',
          icon: Info,
          label: 'Weak Fit'
        };
      case 'SECURITY_QUARANTINE':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900',
          icon: XCircle,
          label: 'Quarantine'
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
          icon: Info,
          label: rec
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="clean-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#163832] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari token, posisi, atau keahlian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#C2E0C4] rounded-xl text-xs text-[#0B201B] placeholder-[#6C837C] font-semibold focus:outline-none focus:border-[#235347] focus:ring-1 focus:ring-[#235347]/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#163832]" />
          <span className="text-xs font-bold text-[#163832]">Filter:</span>
          <select
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
            className="bg-white border border-[#C2E0C4] rounded-xl text-xs text-[#0B201B] font-bold px-3 py-2 focus:outline-none focus:border-[#235347]"
          >
            <option value="ALL">Semua Rekomendasi ({candidates.length})</option>
            <option value="STRONG_MATCH">Strong Match</option>
            <option value="REVIEW_REQUIRED">Review Required</option>
            <option value="WEAK_FIT">Weak Fit</option>
            <option value="SECURITY_QUARANTINE">Security Quarantine</option>
          </select>
        </div>
      </div>

      {/* Mobile Scroll Indicator */}
      <div className="flex items-center justify-between px-2 text-[11px] text-[#235347] font-semibold sm:hidden">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-[#163832]" />
          <span>Geser tabel ke samping untuk melihat kolom lengkap</span>
        </span>
        <span className="font-mono font-bold text-[#0B2B26]">&rarr;</span>
      </div>

      {/* Clean Light Table */}
      <div className="clean-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#EEF4F0] text-[#0B2B26] font-extrabold uppercase tracking-wider text-xs border-b-2 border-[#C2E0C4]">
              <tr>
                <th className="py-3.5 px-4 font-extrabold">Kandidat (Anonim UU PDP)</th>
                <th className="py-3.5 px-4 font-extrabold">Posisi & Waktu</th>
                <th className="py-3.5 px-4 text-center font-extrabold">Skor 4D</th>
                <th className="py-3.5 px-4 font-extrabold">Rekomendasi AI</th>
                <th className="py-3.5 px-4 font-extrabold">Audit GitHub</th>
                <th className="py-3.5 px-4 font-extrabold">Keahlian Terverifikasi</th>
                <th className="py-3.5 px-4 text-right font-extrabold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1EBE4]">
              {filtered.map((candidate) => {
                const recInfo = getRecBadge(candidate.recommendation);
                const RecIcon = recInfo.icon;

                return (
                  <tr 
                    key={candidate.id} 
                    className="hover:bg-[#EEF4F0]/60 transition-colors group cursor-pointer"
                    onClick={() => onSelectCandidate(candidate)}
                  >
                    {/* Identifier */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0B2B26] text-white border border-[#0B2B26] flex items-center justify-center font-mono font-bold text-xs shadow-xs">
                          {candidate.id}
                        </div>
                        <div>
                          <div className="font-mono font-black text-[#0B201B] text-xs">
                            {candidate.masked_identifier}
                          </div>
                          <div className="text-[11px] font-semibold text-[#235347]">
                            {candidate.candidate_name_masked}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-[#0B201B] text-xs">{candidate.job_title}</div>
                      <div className="text-[11px] font-semibold text-[#235347]">{candidate.applied_date}</div>
                    </td>

                    {/* 4D Overall Score */}
                    <td className="py-4 px-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-extrabold text-xs border shadow-xs ${getScoreBadge(candidate.overall_score)}`}>
                        <Zap className="w-3 h-3" />
                        <span>{candidate.overall_score.toFixed(1)}</span>
                      </div>
                      <div className="text-[10px] text-[#163832] font-bold mt-1 font-mono">
                        Comp: {candidate.scores_4d.s_comp} | Risk: {candidate.scores_4d.s_risk}
                      </div>
                    </td>

                    {/* Recommendation */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${recInfo.bg}`}>
                        <RecIcon className="w-3.5 h-3.5" />
                        <span>{recInfo.label}</span>
                      </span>
                      {candidate.flags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {candidate.flags.map((flag, idx) => (
                            <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono font-medium">
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DAF1DE] text-[#0B2B26] border border-[#C2E0C4] hover:bg-[#C2E0C4] transition-colors"
                        >
                          <Github className="w-3.5 h-3.5" />
                          <span className="font-mono text-[11px] font-semibold">Verified</span>
                          <ExternalLink className="w-3 h-3 text-[#235347]" />
                        </a>
                      ) : candidate.github_status === 'NOT_APPLICABLE' ? (
                        <span className="text-[11px] text-[#163832] font-mono bg-[#EEF4F0] px-2.5 py-1 rounded-full border border-[#C2E0C4] font-bold">
                          N/A (Non-IT)
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-700 font-mono bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 font-medium">
                          Audit Failed
                        </span>
                      )}
                    </td>

                    {/* Technologies */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {candidate.key_technologies.slice(0, 3).map((tech, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-[#EEF4F0] text-[#0B201B] border border-[#C2E0C4] font-bold font-mono">
                            {tech}
                          </span>
                        ))}
                        {candidate.key_technologies.length > 3 && (
                          <span className="text-[10px] text-[#163832] font-extrabold px-1 py-0.5">
                            +{candidate.key_technologies.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onStreamCandidate) onStreamCandidate(candidate);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0B2B26] hover:bg-[#163832] text-white text-[11px] font-bold transition-all shadow-sm group btn-interactive"
                          title="Saksikan Live SSE Agent Stream"
                          aria-label="Saksikan Live SSE Agent Stream"
                        >
                          <Radio className="w-3.5 h-3.5 text-emerald-300 group-hover:animate-pulse" />
                          <span className="hidden xl:inline">Live SSE</span>
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCandidate(candidate);
                          }}
                          className="p-1.5 rounded-xl bg-[#EEF4F0] hover:bg-[#DAF1DE] hover:text-[#0B2B26] text-[#0B2B26] border border-[#C2E0C4] transition-colors btn-interactive"
                          title="Lihat Rincian Dossier"
                          aria-label="Lihat Rincian Dossier"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
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
