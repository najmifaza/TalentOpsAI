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
  Radio, 
  Play, 
  Clock, 
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export default function CandidateTable({ 
  candidates, 
  onSelectCandidate, 
  onStreamCandidate,
  onStartTriage,
  onBatchTriage,
  isBatchRunning = false
}) {
  const [search, setSearch] = useState('');
  const [filterRec, setFilterRec] = useState('ALL');
  const [scanTab, setScanTab] = useState('ALL'); // 'ALL' | 'UNSCANNED' | 'SCANNED'

  // Partition candidates based on scan status
  const unscannedCandidates = candidates.filter(c => 
    c.scan_status === 'UNSCANNED' || 
    c.overall_score === null || 
    c.overall_score === undefined ||
    c.recommendation === 'PENDING_SCAN' || 
    c.status === 'queued'
  );

  const scannedCandidates = candidates.filter(c => 
    !unscannedCandidates.some(u => u.id === c.id)
  );

  // Filter candidates according to selected tab, search query, and recommendation
  const filtered = candidates.filter(c => {
    // 1. Tab Scan Filter
    const isUnscanned = unscannedCandidates.some(u => u.id === c.id);
    if (scanTab === 'UNSCANNED' && !isUnscanned) return false;
    if (scanTab === 'SCANNED' && isUnscanned) return false;

    // 2. Search Filter
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      (c.masked_identifier && c.masked_identifier.toLowerCase().includes(q)) ||
      (c.tracking_token && c.tracking_token.toLowerCase().includes(q)) ||
      (c.job_title && c.job_title.toLowerCase().includes(q)) ||
      (c.candidate_name_masked && c.candidate_name_masked.toLowerCase().includes(q)) ||
      (c.key_technologies && c.key_technologies.some(t => t.toLowerCase().includes(q)));

    // 3. Recommendation Filter
    const matchesRec = filterRec === 'ALL' || c.recommendation === filterRec;

    return matchesSearch && matchesRec;
  });

  const getScoreBadge = (score) => {
    if (score >= 85) {
      return 'bg-blue-50 text-[#1b55f5] border-blue-200/80';
    } else if (score >= 60) {
      return 'bg-amber-50 text-amber-800 border-amber-200/80';
    } else {
      return 'bg-rose-50 text-rose-800 border-rose-200/80';
    }
  };

  const getRecBadge = (rec) => {
    switch (rec) {
      case 'STRONG_MATCH':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/70',
          icon: CheckCircle2,
          label: 'Sangat Sesuai'
        };
      case 'REVIEW_REQUIRED':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200/70',
          icon: AlertTriangle,
          label: 'Perlu Review HR'
        };
      case 'WEAK_FIT':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Info,
          label: 'Kurang Sesuai'
        };
      case 'SECURITY_QUARANTINE':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200/80',
          icon: ShieldAlert,
          label: 'Karantina Keamanan'
        };
      case 'PENDING_SCAN':
      default:
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
          icon: Clock,
          label: 'Menunggu Scan'
        };
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* 1. Header Filters & Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        {/* Segmented Control */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/60 w-fit">
          <button
            onClick={() => setScanTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Semua Pelamar</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
              scanTab === 'ALL' ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/70 text-slate-500'
            }`}>
              {candidates.length}
            </span>
          </button>

          <button
            onClick={() => setScanTab('UNSCANNED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'UNSCANNED'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-500 hover:text-amber-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Belum Di-scan</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
              unscannedCandidates.length > 0 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-slate-200/70 text-slate-500'
            }`}>
              {unscannedCandidates.length}
            </span>
          </button>

          <button
            onClick={() => setScanTab('SCANNED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'SCANNED'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sudah Di-scan</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
              scanTab === 'SCANNED' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200/70 text-slate-500'
            }`}>
              {scannedCandidates.length}
            </span>
          </button>
        </div>

        {/* Action Link & Info */}
        <div className="flex items-center gap-2">
          {unscannedCandidates.length > 0 && onBatchTriage && (
            <button
              onClick={onBatchTriage}
              disabled={isBatchRunning}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Zap className={`w-3.5 h-3.5 ${isBatchRunning ? 'animate-spin' : 'fill-current'}`} />
              <span>{isBatchRunning ? 'Memproses...' : `Scan Semua (${unscannedCandidates.length})`}</span>
            </button>
          )}
          <span className="text-xs text-slate-400 hidden lg:inline-block">
            Klik baris untuk melihat dossier kandidat
          </span>
        </div>
      </div>

      {/* 2. Search & Select Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari ID berkas, posisi, atau keahlian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-[#1b55f5] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 shrink-0">Filter:</span>
          <select
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
            className="bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold px-3 py-2 focus:outline-none focus:border-[#1b55f5] focus:bg-white transition-all w-full sm:w-auto"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="STRONG_MATCH">Sangat Sesuai (Lolos)</option>
            <option value="REVIEW_REQUIRED">Perlu Review HR</option>
            <option value="WEAK_FIT">Kurang Sesuai</option>
            <option value="SECURITY_QUARANTINE">Karantina Keamanan</option>
            <option value="PENDING_SCAN">Belum Di-scan</option>
          </select>
        </div>
      </div>

      {/* 3. Candidates Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-5 font-bold">Kandidat</th>
                <th className="py-3.5 px-4 font-bold">Posisi &amp; Tanggal</th>
                <th className="py-3.5 px-4 text-center font-bold">Skor 4D</th>
                <th className="py-3.5 px-4 font-bold">Rekomendasi AI</th>
                <th className="py-3.5 px-4 font-bold">Audit GitHub</th>
                <th className="py-3.5 px-4 font-bold">Keahlian</th>
                <th className="py-3.5 px-5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-medium">
                    Tidak ada berkas kandidat yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((candidate) => {
                  const isUnscanned = unscannedCandidates.some(u => u.id === candidate.id);
                  const recInfo = getRecBadge(candidate.recommendation);
                  const RecIcon = recInfo.icon;

                  return (
                    <tr 
                      key={candidate.id} 
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => onSelectCandidate(candidate)}
                    >
                      {/* Identifier */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isUnscanned 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-blue-50 text-[#1b55f5] border border-blue-200'
                          }`}>
                            {candidate.id}
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-slate-900 text-xs truncate">
                              {candidate.masked_identifier}
                            </div>
                            <div className="text-[11px] font-medium text-slate-400 truncate">
                              {candidate.candidate_name_masked}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Position & Date */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800 text-xs">{candidate.job_title}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{candidate.applied_date}</div>
                      </td>

                      {/* Overall Score */}
                      <td className="py-4 px-4 text-center">
                        {isUnscanned || candidate.overall_score === null ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Belum Scan</span>
                          </span>
                        ) : (
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs border ${getScoreBadge(candidate.overall_score)}`}>
                              <Zap className="w-3 h-3 fill-current" />
                              <span>{candidate.overall_score.toFixed(1)}</span>
                            </span>
                            {candidate.scores_4d && (
                              <div className="text-[10px] text-slate-400 font-medium mt-1">
                                Skill: {candidate.scores_4d.s_comp}%
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Recommendation Status */}
                      <td className="py-4 px-4">
                        {isUnscanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Menunggu Scan</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${recInfo.bg}`}>
                            <RecIcon className="w-3.5 h-3.5" />
                            <span>{recInfo.label}</span>
                          </span>
                        )}

                        {candidate.flags && candidate.flags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {candidate.flags.map((flag, idx) => (
                              <span key={idx} className="text-[9px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono font-medium">
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* GitHub Audit */}
                      <td className="py-4 px-4">
                        {isUnscanned ? (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Pending
                          </span>
                        ) : candidate.github_status === 'VERIFIED' ? (
                          <a 
                            href={candidate.verified_github || '#'} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-[#1b55f5] border border-blue-200/80 hover:bg-blue-100 transition-colors"
                          >
                            <Github className="w-3.5 h-3.5" />
                            <span className="font-mono text-[11px] font-semibold">Valid Repo</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : candidate.github_status === 'NOT_APPLICABLE' ? (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Non-Teknis
                          </span>
                        ) : (
                          <span className="text-[11px] text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-medium">
                            Anomali
                          </span>
                        )}
                      </td>

                      {/* Technologies / Skills */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[190px]">
                          {candidate.key_technologies && candidate.key_technologies.slice(0, 3).map((tech, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200/60 font-mono">
                              {tech}
                            </span>
                          ))}
                          {candidate.key_technologies && candidate.key_technologies.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-bold px-1 py-0.5">
                              +{candidate.key_technologies.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isUnscanned ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onStartTriage) {
                                  onStartTriage(candidate);
                                } else if (onStreamCandidate) {
                                  onStreamCandidate(candidate);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b55f5] hover:bg-[#1545c7] active:scale-98 text-white text-xs font-bold transition-all shadow-xs"
                              title="Jalankan Proses AI untuk Kandidat Ini"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Mulai AI</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onStreamCandidate) onStreamCandidate(candidate);
                                }}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-[#1b55f5] text-slate-500 border border-slate-200 transition-colors"
                                title="Lihat Rekaman Langkah AI"
                              >
                                <Radio className="w-3.5 h-3.5 text-[#1b55f5]" />
                              </button>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectCandidate(candidate);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold transition-colors"
                                title="Lihat Rincian Dossier"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#1b55f5]" />
                                <span>Detail</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
