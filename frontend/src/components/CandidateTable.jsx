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
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
                          (c.masked_identifier && c.masked_identifier.toLowerCase().includes(q)) ||
                          (c.tracking_token && c.tracking_token.toLowerCase().includes(q)) ||
                          (c.job_title && c.job_title.toLowerCase().includes(q)) ||
                          (c.key_technologies && c.key_technologies.some(t => t.toLowerCase().includes(q)));
    const matchesRec = filterRec === 'ALL' || c.recommendation === filterRec || (filterRec === 'QUEUED' && (!c.recommendation || c.status === 'queued'));
    return matchesSearch && matchesRec;
  });

  const getScoreBadge = (score) => {
    if (score >= 85) {
      return 'bg-[#eaf0ff] text-[#1b55f5] border-[#8ec0ff]';
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
          bg: 'bg-[#eaf0ff] text-[#1b55f5] border-[#8ec0ff]',
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
          bg: 'bg-[#f4f4f6] text-[#454554] border-[#e6e6ea]',
          icon: Info,
          label: 'Weak Fit'
        };
      case 'SECURITY_QUARANTINE':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: XCircle,
          label: 'Quarantine'
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
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
          <Search className="w-4 h-4 text-[#67677e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari token, posisi, atau keahlian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] placeholder-[#67677e] font-medium focus:outline-none focus:border-[#1b55f5] focus:ring-1 focus:ring-[#1b55f5]/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#67677e]" />
          <span className="text-xs font-bold text-[#454554]">Filter:</span>
          <select
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
            className="bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] font-medium px-3 py-2 focus:outline-none focus:border-[#1b55f5]"
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
            <thead className="bg-[#f4f4f6] text-[#454554] font-bold uppercase tracking-wider text-[11px] border-b border-[#e6e6ea]">
              <tr>
                <th className="py-3.5 px-4 font-bold">Kandidat (Anonim UU PDP)</th>
                <th className="py-3.5 px-4 font-bold">Posisi & Waktu</th>
                <th className="py-3.5 px-4 text-center font-bold">Skor 4D</th>
                <th className="py-3.5 px-4 font-bold">Rekomendasi AI</th>
                <th className="py-3.5 px-4 font-bold">Audit GitHub</th>
                <th className="py-3.5 px-4 font-bold">Keahlian Terverifikasi</th>
                <th className="py-3.5 px-4 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e6ea] bg-white">
              {filtered.map((candidate) => {
                const recInfo = getRecBadge(candidate.recommendation);
                const RecIcon = recInfo.icon;

                return (
                  <tr 
                    key={candidate.id} 
                    className="hover:bg-[#f8f9fc] transition-colors group cursor-pointer"
                    onClick={() => onSelectCandidate(candidate)}
                  >
                    {/* Identifier */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#2b2d32] text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs">
                          {candidate.id}
                        </div>
                        <div>
                          <div className="font-mono font-bold text-[#000000] text-xs">
                            {candidate.masked_identifier}
                          </div>
                          <div className="text-[11px] font-medium text-[#67677e]">
                            {candidate.candidate_name_masked}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-[#000000] text-xs">{candidate.job_title}</div>
                      <div className="text-[11px] font-medium text-[#67677e]">{candidate.applied_date}</div>
                    </td>

                    {/* 4D Overall Score */}
                    <td className="py-4 px-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-extrabold text-xs border shadow-xs ${getScoreBadge(candidate.overall_score)}`}>
                        <Zap className="w-3 h-3" />
                        <span>{candidate.overall_score.toFixed(1)}</span>
                      </div>
                      <div className="text-[10px] text-[#67677e] font-semibold mt-1 font-mono">
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eaf0ff] text-[#1b55f5] border border-[#8ec0ff] hover:bg-[#d8e5ff] transition-colors"
                        >
                          <Github className="w-3.5 h-3.5" />
                          <span className="font-mono text-[11px] font-semibold">Verified</span>
                          <ExternalLink className="w-3 h-3 text-[#1b55f5]" />
                        </a>
                      ) : candidate.github_status === 'NOT_APPLICABLE' ? (
                        <span className="text-[11px] text-[#67677e] font-mono bg-[#f4f4f6] px-2.5 py-1 rounded-full border border-[#e6e6ea] font-medium">
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
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-[#f4f4f6] text-[#454554] border border-[#e6e6ea] font-semibold font-mono">
                            {tech}
                          </span>
                        ))}
                        {candidate.key_technologies.length > 3 && (
                          <span className="text-[10px] text-[#67677e] font-bold px-1 py-0.5">
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
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] text-white text-[11px] font-bold transition-all shadow-sm group btn-interactive"
                          title="Saksikan Live SSE Agent Stream"
                          aria-label="Saksikan Live SSE Agent Stream"
                        >
                          <Radio className="w-3.5 h-3.5 text-white group-hover:animate-pulse" />
                          <span className="hidden xl:inline">Live SSE</span>
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCandidate(candidate);
                          }}
                          className="p-1.5 rounded-lg bg-[#f4f4f6] hover:bg-[#eaf0ff] hover:text-[#1b55f5] text-[#000000] border border-[#d8d8df] transition-colors btn-interactive"
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
