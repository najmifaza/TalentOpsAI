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
  Check,
  FileText,
  Sparkles
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
          label: 'Sangat Sesuai'
        };
      case 'REVIEW_REQUIRED':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: AlertTriangle,
          label: 'Perlu Ditinjau HR'
        };
      case 'WEAK_FIT':
        return {
          bg: 'bg-[#f4f4f6] text-[#454554] border-[#e6e6ea]',
          icon: Info,
          label: 'Kurang Sesuai'
        };
      case 'SECURITY_QUARANTINE':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: XCircle,
          label: 'Karantina Dokumen'
        };
      case 'PENDING_SCAN':
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: Clock,
          label: 'Belum Di-scan'
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Status Filter Tabs (Semua / Belum Di-scan / Sudah Di-scan) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e6ea] pb-3">
        <div className="inline-flex p-1 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea]">
          <button
            onClick={() => setScanTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'ALL'
                ? 'bg-white text-[#000000] shadow-xs'
                : 'text-[#67677e] hover:text-[#000000]'
            }`}
          >
            <span>Semua Pelamar</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              scanTab === 'ALL' ? 'bg-[#f4f4f6] text-[#000000]' : 'bg-[#e6e6ea] text-[#67677e]'
            }`}>
              {candidates.length}
            </span>
          </button>

          <button
            onClick={() => setScanTab('UNSCANNED')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'UNSCANNED'
                ? 'bg-white text-[#1b55f5] shadow-xs'
                : 'text-[#67677e] hover:text-[#1b55f5]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Belum Di-scan</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              unscannedCandidates.length > 0 
                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                : 'bg-[#e6e6ea] text-[#67677e]'
            }`}>
              {unscannedCandidates.length}
            </span>
          </button>

          <button
            onClick={() => setScanTab('SCANNED')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'SCANNED'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-[#67677e] hover:text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sudah Di-scan</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              scanTab === 'SCANNED' ? 'bg-emerald-50 text-emerald-800' : 'bg-[#e6e6ea] text-[#67677e]'
            }`}>
              {scannedCandidates.length}
            </span>
          </button>
        </div>

        {/* Right Info Note / Action */}
        <div className="flex items-center gap-2">
          {unscannedCandidates.length > 0 && onBatchTriage && (
            <button
              onClick={onBatchTriage}
              disabled={isBatchRunning}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              title="Jalankan AI Triage untuk seluruh kandidat yang belum di-scan"
            >
              <Zap className={`w-3.5 h-3.5 ${isBatchRunning ? 'animate-spin' : 'fill-current'}`} />
              <span>{isBatchRunning ? 'Sedang Batch...' : `Scan Semua (${unscannedCandidates.length})`}</span>
            </button>
          )}
          <div className="text-xs text-[#67677e] hidden md:flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#1b55f5]" />
            <span>Klik <strong>"Mulai Analisis AI"</strong> untuk evaluasi berkas</span>
          </div>
        </div>
      </div>

      {/* 2. Search & Secondary Filters Bar */}
      <div className="clean-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#67677e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari ID berkas, posisi, atau keahlian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] placeholder-[#67677e] font-medium focus:outline-none focus:border-[#1b55f5] focus:ring-1 focus:ring-[#1b55f5]/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#67677e]" />
          <span className="text-xs font-bold text-[#454554]">Rekomendasi:</span>
          <select
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
            className="bg-white border border-[#d8d8df] rounded-lg text-xs text-[#000000] font-medium px-3 py-2 focus:outline-none focus:border-[#1b55f5]"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="STRONG_MATCH">Sangat Sesuai (Lolos)</option>
            <option value="REVIEW_REQUIRED">Perlu Ditinjau HR</option>
            <option value="WEAK_FIT">Kurang Sesuai</option>
            <option value="SECURITY_QUARANTINE">Karantina Dokumen</option>
            <option value="PENDING_SCAN">Belum Di-scan</option>
          </select>
        </div>
      </div>

      {/* 3. Candidates Table */}
      <div className="clean-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#f4f4f6] text-[#454554] font-bold uppercase tracking-wider text-[11px] border-b border-[#e6e6ea]">
              <tr>
                <th className="py-3.5 px-4 font-bold">Kandidat (Anonim UU PDP)</th>
                <th className="py-3.5 px-4 font-bold">Posisi &amp; Waktu Masuk</th>
                <th className="py-3.5 px-4 text-center font-bold">Skor Kesesuaian</th>
                <th className="py-3.5 px-4 font-bold">Status Analisis AI</th>
                <th className="py-3.5 px-4 font-bold">Portofolio GitHub</th>
                <th className="py-3.5 px-4 font-bold">Keahlian Utama</th>
                <th className="py-3.5 px-4 text-right font-bold">Aksi HR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e6ea] bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#67677e] text-xs">
                    Tidak ada berkas kandidat yang cocok dengan kriteria filter saat ini.
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
                      className={`hover:bg-[#f8f9fc] transition-colors group cursor-pointer ${
                        isUnscanned ? 'bg-amber-50/20' : ''
                      }`}
                      onClick={() => onSelectCandidate(candidate)}
                    >
                      {/* Identifier */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shadow-xs ${
                            isUnscanned 
                              ? 'bg-amber-500 text-white' 
                              : 'bg-[#2b2d32] text-white'
                          }`}>
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

                      {/* Position & Date */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#000000] text-xs">{candidate.job_title}</div>
                        <div className="text-[11px] font-medium text-[#67677e]">{candidate.applied_date}</div>
                      </td>

                      {/* Overall Score */}
                      <td className="py-4 px-4 text-center">
                        {isUnscanned || candidate.overall_score === null ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#f4f4f6] text-[#67677e] border border-[#e6e6ea]">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Belum Dianalisis</span>
                          </div>
                        ) : (
                          <>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-extrabold text-xs border shadow-xs ${getScoreBadge(candidate.overall_score)}`}>
                              <Zap className="w-3 h-3" />
                              <span>{candidate.overall_score.toFixed(1)} / 100</span>
                            </div>
                            {candidate.scores_4d && (
                              <div className="text-[10px] text-[#67677e] font-semibold mt-1">
                                Keahlian: {candidate.scores_4d.s_comp}% &bull; Portofolio: {candidate.scores_4d.s_port}%
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Recommendation Status */}
                      <td className="py-4 px-4">
                        {isUnscanned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Menunggu Analisis AI</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${recInfo.bg}`}>
                            <RecIcon className="w-3.5 h-3.5" />
                            <span>{recInfo.label}</span>
                          </span>
                        )}

                        {candidate.flags && candidate.flags.length > 0 && (
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
                        {isUnscanned ? (
                          <span className="text-[11px] text-[#67677e] font-mono bg-[#f4f4f6] px-2.5 py-1 rounded-full border border-[#e6e6ea]">
                            Menunggu Pemindaian
                          </span>
                        ) : candidate.github_status === 'VERIFIED' ? (
                          <a 
                            href={candidate.verified_github || '#'} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eaf0ff] text-[#1b55f5] border border-[#8ec0ff] hover:bg-[#d8e5ff] transition-colors"
                          >
                            <Github className="w-3.5 h-3.5" />
                            <span className="font-mono text-[11px] font-semibold">Portofolio Valid</span>
                            <ExternalLink className="w-3 h-3 text-[#1b55f5]" />
                          </a>
                        ) : candidate.github_status === 'NOT_APPLICABLE' ? (
                          <span className="text-[11px] text-[#67677e] font-mono bg-[#f4f4f6] px-2.5 py-1 rounded-full border border-[#e6e6ea] font-medium">
                            Non-Teknis (N/A)
                          </span>
                        ) : (
                          <span className="text-[11px] text-rose-700 font-mono bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 font-medium">
                            Anomali Kode
                          </span>
                        )}
                      </td>

                      {/* Technologies / Skills */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {candidate.key_technologies && candidate.key_technologies.slice(0, 3).map((tech, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-[#f4f4f6] text-[#454554] border border-[#e6e6ea] font-semibold">
                              {tech}
                            </span>
                          ))}
                          {candidate.key_technologies && candidate.key_technologies.length > 3 && (
                            <span className="text-[10px] text-[#67677e] font-bold px-1 py-0.5">
                              +{candidate.key_technologies.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-4 text-right">
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
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] text-white text-xs font-bold transition-all shadow-xs group"
                              title="Jalankan Proses AI untuk Kandidat Ini"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Mulai Analisis AI</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onStreamCandidate) onStreamCandidate(candidate);
                                }}
                                className="p-1.5 rounded-lg bg-[#f4f4f6] hover:bg-[#eaf0ff] hover:text-[#1b55f5] text-[#67677e] border border-[#d8d8df] transition-colors"
                                title="Lihat Rekaman Langkah AI"
                              >
                                <Radio className="w-4 h-4 text-[#1b55f5]" />
                              </button>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectCandidate(candidate);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#f4f4f6] text-[#000000] border border-[#d8d8df] text-xs font-semibold transition-colors"
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
