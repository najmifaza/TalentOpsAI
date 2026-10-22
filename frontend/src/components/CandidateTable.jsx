import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
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
  ShieldAlert
} from 'lucide-react';
import { DIMENSIONS } from '../lib/dimensions';
import { categorize, isUnscanned, flagLabel, dedupeFlags, formatScore } from '../lib/labels';

// Two-char badge from the masked identifier ("#TK-A17C9B" -> "9B"). The raw
// database id was rendered here and overflowed the box past two digits.
const initialsOf = (masked) => {
  const clean = String(masked || '').replace(/[^A-Za-z0-9]/g, '');
  return clean.slice(-2).toUpperCase() || '—';
};

export default function CandidateTable({ 
  candidates, 
  onSelectCandidate, 
  onStreamCandidate,
  onStartTriage
}) {
  const [search, setSearch] = useState('');
  const [filterRec, setFilterRec] = useState('ALL');
  const [scanTab, setScanTab] = useState('ALL');

  const unscannedCandidates = candidates.filter(isUnscanned);

  const scannedCandidates = candidates.filter(c => !isUnscanned(c));

  const filtered = candidates.filter(c => {
    const unscanned = isUnscanned(c);
    if (scanTab === 'UNSCANNED' && !unscanned) return false;
    if (scanTab === 'SCANNED' && unscanned) return false;

    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      (c.masked_identifier && c.masked_identifier.toLowerCase().includes(q)) ||
      (c.tracking_token && c.tracking_token.toLowerCase().includes(q)) ||
      (c.job_title && c.job_title.toLowerCase().includes(q)) ||
      (c.candidate_name_masked && c.candidate_name_masked.toLowerCase().includes(q)) ||
      (c.key_technologies && c.key_technologies.some(t => t.toLowerCase().includes(q)));

    // Same `categorize` the KPI cards and the per-job cards use, so filtering by
    // "Karantina Keamanan" returns the rows those cards counted.
    const matchesRec = filterRec === 'ALL' || categorize(c) === filterRec;

    return matchesSearch && matchesRec;
  });

  const getScoreBadge = (score) => {
    if (score >= 85) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    } else if (score >= 60) {
      return 'bg-primary-orange/10 text-primary-orange border-primary-orange/30';
    } else {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
  };

  const getRecBadge = (rec) => {
    switch (rec) {
      case 'STRONG_MATCH':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
          label: 'Sangat Sesuai'
        };
      case 'REVIEW_REQUIRED':
        return {
          bg: 'bg-primary-blue/10 text-primary-black border-primary-blue/30',
          icon: AlertTriangle,
          label: 'Perlu Review HR'
        };
      case 'WEAK_FIT':
        return {
          bg: 'bg-primary-slate-100 text-primary-slate-700 border-primary-border-200',
          icon: Info,
          label: 'Kurang Sesuai'
        };
      case 'SECURITY_QUARANTINE':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: ShieldAlert,
          label: 'Karantina Keamanan'
        };
      case 'PENDING_SCAN':
      default:
        return {
          bg: 'bg-primary-orange/10 text-primary-orange border-primary-orange/30',
          icon: Clock,
          label: 'Menunggu Scan'
        };
    }
  };

  return (
    <div className="space-y-4 font-jkt">
      {/* 1. Header Filters & Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary-border-100 pb-3">
        {/* Segmented Control — wraps instead of overflowing at 390px, where the
            three labels needed 362px inside a 352px container. */}
        <div className="inline-flex flex-wrap p-1 rounded-full bg-primary-slate-100 border border-primary-border-200 w-fit max-w-full">
          <button
            onClick={() => setScanTab('ALL')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'ALL'
                ? 'bg-white text-primary-black shadow-xs font-bold'
                : 'text-primary-slate-600 hover:text-primary-black'
            }`}
          >
            <span>Semua Pelamar</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              scanTab === 'ALL' ? 'bg-primary-slate-100 text-primary-black' : 'bg-primary-slate-200/70 text-primary-slate-500'
            }`}>
              {candidates.length}
            </span>
          </button>

          <button
            onClick={() => setScanTab('UNSCANNED')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'UNSCANNED'
                ? 'bg-white text-primary-orange shadow-xs font-bold'
                : 'text-primary-slate-600 hover:text-primary-orange'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-primary-orange" />
            <span>Belum Di-scan</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              unscannedCandidates.length > 0 
                ? 'bg-primary-orange/10 text-primary-orange' 
                : 'bg-primary-slate-200/70 text-primary-slate-500'
            }`}>
              {unscannedCandidates.length}
            </span>
          </button>

          <button
            onClick={() => setScanTab('SCANNED')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
              scanTab === 'SCANNED'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-primary-slate-600 hover:text-emerald-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sudah Di-scan</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              scanTab === 'SCANNED' ? 'bg-emerald-50 text-emerald-800' : 'bg-primary-slate-200/70 text-primary-slate-500'
            }`}>
              {scannedCandidates.length}
            </span>
          </button>
        </div>

        {/* Action Link & Info */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary-slate-400 hidden lg:inline-block">
            Klik baris untuk membuka evaluasi lengkap kandidat
          </span>
        </div>
      </div>

      {/* 2. Search & Select Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-primary-border-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-primary-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari ID berkas, posisi, atau keahlian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black placeholder:text-primary-slate-400 font-medium focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-primary-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-primary-slate-600 shrink-0">Filter Kategori:</span>
          <select
            value={filterRec}
            onChange={(e) => setFilterRec(e.target.value)}
            className="bg-primary-slate-50 border border-primary-border-200 rounded-xl text-xs text-primary-black font-semibold px-3 py-2 focus:outline-none focus:border-primary-orange focus:ring-2 focus:ring-primary-orange/20 focus:bg-white transition-all w-full sm:w-auto"
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

      {/* 3a. Mobile card list. A 720px-wide table forced horizontal scrolling on
          phones with no hint that more columns existed, so small screens get cards. */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-primary-border-200 p-8 text-center text-xs text-primary-slate-500">
            Tidak ada berkas kandidat yang cocok dengan kriteria pencarian.
          </div>
        ) : (
          filtered.map((candidate) => {
            const isUnscanned = unscannedCandidates.some(u => u.id === candidate.id);
            const recInfo = getRecBadge(categorize(candidate));
            const RecIcon = recInfo.icon;
            return (
              <div
                key={candidate.id}
                onClick={() => onSelectCandidate(candidate)}
                className="bg-white rounded-2xl border border-primary-border-200 p-4 shadow-sm active:bg-primary-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-primary-black text-xs truncate">
                      {candidate.masked_identifier}
                    </p>
                    <p className="text-[11px] text-primary-slate-500 truncate">{candidate.job_title}</p>
                  </div>
                  {isUnscanned || candidate.overall_score === null ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-slate-100 text-primary-slate-600 border border-primary-border-200">
                      <Clock className="w-2.5 h-2.5 text-primary-orange" /> Belum Scan
                    </span>
                  ) : (
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-extrabold text-xs border ${getScoreBadge(candidate.overall_score)}`}>
                      {formatScore(candidate.overall_score)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-primary-border-100">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${recInfo.bg}`}>
                    <RecIcon className="w-2.5 h-2.5" /> {recInfo.label}
                  </span>
                  <span className="text-[10px] text-primary-slate-400">{candidate.applied_date}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3b. Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-primary-border-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-primary-slate-50 text-primary-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-primary-border-100">
              <tr>
                <th className="py-3.5 px-5 font-bold">Kandidat</th>
                <th className="py-3.5 px-4 font-bold">Posisi &amp; Tanggal</th>
                <th className="py-3.5 px-4 text-center font-bold">Skor Total &amp; 4D</th>
                <th className="py-3.5 px-4 font-bold">Rekomendasi AI</th>
                <th className="py-3.5 px-4 font-bold">Audit GitHub</th>
                <th className="py-3.5 px-4 font-bold">Keahlian</th>
                <th className="py-3.5 px-5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-border-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-primary-slate-400 text-xs font-medium">
                    Tidak ada berkas kandidat yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((candidate) => {
                  const isUnscanned = unscannedCandidates.some(u => u.id === candidate.id);
                  const recInfo = getRecBadge(categorize(candidate));
                  const RecIcon = recInfo.icon;

                  return (
                    <tr 
                      key={candidate.id} 
                      className="hover:bg-primary-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => onSelectCandidate(candidate)}
                    >
                      {/* Identifier */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                            isUnscanned 
                              ? 'bg-primary-orange/10 text-primary-orange border border-primary-orange/30' 
                              : 'bg-primary-blue/10 text-primary-black border border-primary-blue/30'
                          }`}>
                            {initialsOf(candidate.masked_identifier)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-primary-black text-xs truncate">
                              {candidate.masked_identifier}
                            </div>
                            <div className="text-[11px] font-medium text-primary-slate-400 truncate">
                              {candidate.candidate_name_masked}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Position & Date */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-primary-black text-xs">{candidate.job_title}</div>
                        <div className="text-[11px] text-primary-slate-400 font-medium">{candidate.applied_date}</div>
                      </td>

                      {/* Overall Score */}
                      <td className="py-4 px-4 text-center">
                        {isUnscanned || candidate.overall_score === null ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary-slate-100 text-primary-slate-600 border border-primary-border-200">
                            <Clock className="w-3 h-3 text-primary-orange" />
                            <span>Belum Scan</span>
                          </span>
                        ) : (
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-extrabold text-xs border ${getScoreBadge(candidate.overall_score)}`}>
                              <Zap className="w-3 h-3 fill-current" />
                              <span>{formatScore(candidate.overall_score)}</span>
                            </span>
                            {candidate.scores_4d && (
                              <div className="flex items-center justify-center gap-1.5 mt-1">
                                {DIMENSIONS.map((d) => (
                                  <span key={d.key} className="flex items-center gap-0.5 text-[9px] text-primary-slate-500 font-medium tabular-nums whitespace-nowrap" title={d.label}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
                                    <span className="text-primary-slate-400">{d.short}</span>
                                    <span className="text-primary-slate-700">{Math.round(candidate.scores_4d[d.key] ?? 0)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Recommendation Status */}
                      <td className="py-4 px-4">
                        {isUnscanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-orange/10 text-primary-orange border border-primary-orange/30">
                            <Clock className="w-3 h-3 text-primary-orange" />
                            <span>Menunggu Scan</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${recInfo.bg}`}>
                            <RecIcon className="w-3.5 h-3.5" />
                            <span>{recInfo.label}</span>
                          </span>
                        )}

                        {/* Anomalies come from ingestion-time PDF/DOCX auditing, so an
                            unscanned candidate has them before triage ever runs. Show
                            them only once the file has been scanned, and cap the list:
                            a repeated marker can push the count into the hundreds.
                            Backend writes one row per finding, so identical codes are
                            collapsed before the cap and the label is humanised. */}
                        {!isUnscanned && candidate.flags && candidate.flags.length > 0 && (() => {
                          const flags = dedupeFlags(candidate.flags);
                          return (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {flags.slice(0, 3).map((flag) => (
                                <span key={flag} title={flag} className="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                  {flagLabel(flag)}
                                </span>
                              ))}
                              {flags.length > 3 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-slate-100 text-primary-slate-700 border border-primary-border-200 font-medium">
                                  +{flags.length - 3} lainnya
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* GitHub Audit */}
                      <td className="py-4 px-4">
                        {isUnscanned ? (
                          <span className="text-[11px] text-primary-slate-400 font-mono">
                            Pending
                          </span>
                        ) : candidate.github_status === 'VERIFIED' ? (
                          <a 
                            href={candidate.verified_github || '#'} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-blue/10 text-primary-black border border-primary-blue/30 hover:border-primary-orange transition-colors"
                          >
                            <Github className="w-3.5 h-3.5 text-primary-blue" />
                            <span className="font-mono text-[11px] font-semibold">Repo Terdaftar</span>
                            <ExternalLink className="w-2.5 h-2.5 text-primary-slate-400" />
                          </a>
                        ) : candidate.github_status === 'NOT_APPLICABLE' ? (
                          <span className="text-[11px] text-primary-slate-400 font-mono">
                            Non-Teknis
                          </span>
                        ) : (
                          <span className="text-[11px] text-primary-slate-500 font-mono bg-primary-slate-50 px-2 py-0.5 rounded-full border border-primary-border-200 font-medium">
                            Belum Terverifikasi
                          </span>
                        )}
                      </td>

                      {/* Technologies / Skills */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[190px]">
                          {candidate.key_technologies && candidate.key_technologies.slice(0, 3).map((tech, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-primary-slate-50 text-primary-black font-medium border border-primary-border-200 font-mono">
                              {tech}
                            </span>
                          ))}
                          {candidate.key_technologies && candidate.key_technologies.length > 3 && (
                            <span className="text-[10px] text-primary-slate-400 font-bold px-1 py-0.5">
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
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-orange hover:opacity-90 active:scale-98 text-white text-xs font-bold transition-all shadow-md shadow-primary-orange/20"
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
                                className="p-1.5 rounded-full bg-primary-slate-50 hover:bg-primary-orange/10 hover:text-primary-orange text-primary-slate-600 border border-primary-border-200 transition-colors"
                                title="Lihat Rekaman Langkah AI"
                              >
                                <Radio className="w-3.5 h-3.5" />
                              </button>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectCandidate(candidate);
                                }}
                                className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white hover:border-primary-orange text-primary-black border border-primary-border-200 text-xs font-semibold transition-colors"
                                title="Lihat Rincian Dossier"
                              >
                                <Eye className="w-3.5 h-3.5 text-primary-orange" />
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
