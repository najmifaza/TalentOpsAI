import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sliders, 
  RotateCcw, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  ShieldCheck, 
  Download, 
  Filter, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Check, 
  ExternalLink, 
  ChevronRight, 
  Gauge 
} from 'lucide-react';
import { MOCK_CANDIDATES } from '../data/mockCandidates';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

// Preset Kebijakan Rekrutmen
const PRESETS = {
  balanced: {
    name: 'Standar Berimbang (Balanced)',
    desc: 'Pembobotan standar sesuai PRD v2.5.2 (Keahlian & Pengalaman proporsional).',
    weights: { comp: 40, port: 20, conf: 25, risk: 15 },
    cutoff: 75,
  },
  code_first: {
    name: 'Praktik Kode & Portofolio (Code-First)',
    desc: 'Memberikan penekanan besar pada repositori terverifikasi dan keahlian teknis.',
    weights: { comp: 45, port: 35, conf: 15, risk: 5 },
    cutoff: 70,
  },
  security_strict: {
    name: 'Kepatuhan & Integritas Tinggi (Security-Strict)',
    desc: 'Penalti anomali maksimal untuk mencegah manipulasi resume dan hidden text.',
    weights: { comp: 25, port: 15, conf: 25, risk: 35 },
    cutoff: 80,
  },
  junior_friendly: {
    name: 'Bakat Potensial (Fresh Talent / Inclusive)',
    desc: 'Toleransi risiko lebih tinggi dan ambang batas moderat untuk talenta muda.',
    weights: { comp: 50, port: 20, conf: 25, risk: 5 },
    cutoff: 65,
  },
};

export default function WhatIfStudio() {
  const [candidates, setCandidates] = useState(MOCK_CANDIDATES);

  // Load candidate list from backend
  useEffect(() => {
    async function loadCandidates() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/candidates?limit=50`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            const mapped = json.data.map((c, idx) => {
              const match = MOCK_CANDIDATES.find(m => m.masked_identifier === c.masked_identifier || m.id === c.id);
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
          }
        }
      } catch (err) {
        console.warn('Backend candidates fetch fallback for WhatIf:', err);
      }
    }
    loadCandidates();
  }, []);

  // State Bobot (%)
  const [weights, setWeights] = useState(PRESETS.balanced.weights);
  const [cutoffScore, setCutoffScore] = useState(PRESETS.balanced.cutoff);
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [exportNotice, setExportNotice] = useState(false);

  // Normalisasi bobot agar user bisa menggeser dengan intuitif
  const handleWeightChange = (key, val) => {
    setSelectedPreset('custom');
    setWeights(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(100, Number(val)))
    }));
  };

  const handleApplyPreset = (presetKey) => {
    const p = PRESETS[presetKey];
    if (p) {
      setSelectedPreset(presetKey);
      setWeights(p.weights);
      setCutoffScore(p.cutoff);
    }
  };

  const handleReset = () => {
    handleApplyPreset('balanced');
  };

  // Kalkulasi Skor Simulasi In-Memory
  const { simulatedList, stats } = useMemo(() => {
    const totalW = (weights.comp + weights.port + weights.conf + weights.risk) || 1;
    const wCompNorm = weights.comp / totalW;
    const wPortNorm = weights.port / totalW;
    const wConfNorm = weights.conf / totalW;
    const wRiskNorm = weights.risk / totalW;

    // Hitung skor simulasi tiap kandidat
    const evaluated = candidates.map((cand, origIndex) => {
      const sComp = cand.scores_4d.s_comp || 0;
      const sPort = cand.scores_4d.s_port || 0;
      const sConf = cand.scores_4d.s_conf || 0;
      const sRisk = cand.scores_4d.s_risk || 0;

      // S_risk berperan sebagai penalti terbalik (100 - risk)
      const invertedRisk = Math.max(0, 100 - sRisk);

      // Formula Pembobotan Linier Deterministik
      const simulatedScore = Math.round(
        (sComp * wCompNorm +
         sPort * wPortNorm +
         sConf * wConfNorm +
         invertedRisk * wRiskNorm) * 10
      ) / 10;

      // Status rekomendasi baru berdasarkan threshold simulasi
      let newRec = 'WEAK_FIT';
      if (cand.recommendation === 'SECURITY_QUARANTINE') {
        newRec = 'SECURITY_QUARANTINE';
      } else if (simulatedScore >= cutoffScore) {
        newRec = simulatedScore >= 85 ? 'STRONG_MATCH' : 'REVIEW_REQUIRED';
      } else if (simulatedScore >= 60) {
        newRec = 'REVIEW_REQUIRED';
      } else {
        newRec = 'WEAK_FIT';
      }

      const scoreDelta = Math.round((simulatedScore - cand.overall_score) * 10) / 10;
      const isPassed = simulatedScore >= cutoffScore && newRec !== 'SECURITY_QUARANTINE';

      return {
        ...cand,
        origRank: origIndex + 1,
        simulatedScore,
        scoreDelta,
        newRec,
        isPassed,
      };
    });

    // Urutkan berdasarkan skor simulasi tertinggi ke terendah
    const sorted = [...evaluated].sort((a, b) => b.simulatedScore - a.simulatedScore);

    // Tetapkan rank baru dan hitung delta rank
    const withRank = sorted.map((cand, newIdx) => {
      const newRank = newIdx + 1;
      const rankDelta = cand.origRank - newRank; // positif berarti naik peringkat
      return {
        ...cand,
        newRank,
        rankDelta,
      };
    });

    // Statistik Agregat
    const total = withRank.length;
    const passedCount = withRank.filter(c => c.isPassed).length;
    const strongCount = withRank.filter(c => c.newRec === 'STRONG_MATCH').length;
    const avgScore = Math.round((withRank.reduce((acc, c) => acc + c.simulatedScore, 0) / total) * 10) / 10;

    return {
      simulatedList: withRank,
      stats: {
        total,
        passedCount,
        passRate: Math.round((passedCount / total) * 100),
        strongCount,
        avgScore,
      }
    };
  }, [weights, cutoffScore]);

  // Export JSON summary
  const handleExport = () => {
    const payload = {
      simulation_timestamp: new Date().toISOString(),
      policy_weights: weights,
      cutoff_score: cutoffScore,
      aggregate_stats: stats,
      results: simulatedList.map(c => ({
        masked_identifier: c.masked_identifier,
        job_title: c.job_title,
        original_score: c.overall_score,
        simulated_score: c.simulatedScore,
        score_delta: c.scoreDelta,
        original_rank: c.origRank,
        simulated_rank: c.newRank,
        rank_delta: c.rankDelta,
        simulated_recommendation: c.newRec,
        passed_cutoff: c.isPassed,
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talentops_whatif_simulation_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3000);
  };

  const totalWeightPercent = weights.comp + weights.port + weights.conf + weights.risk;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="clean-card p-6 border-l-4 border-l-[#1b55f5] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#eaf0ff] text-[#1b55f5] border border-[#8ec0ff]">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold font-display text-[#000000]">
                What-If Policy Simulation Studio
              </h2>
              <p className="text-xs text-[#67677e] mt-0.5">
                Simulasi penyesuaian bobot rubrik 4D in-memory (0 ms latensi, tanpa panggilan ulang LLM) &bull; PRD Bab 8.2 Endpoint 11
              </p>
            </div>
          </div>
        </div>

        {/* Preset Selector & Actions */}
        <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-[#f4f4f6] text-[#000000] text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#d8d8df]"
            title="Reset ke Standar PRD"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#67677e]" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg bg-[#1b55f5] hover:bg-[#1545c7] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Ekspor Hasil</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Hasil simulasi kebijakan berhasil diunduh dalam format JSON.</span>
          </div>
        </div>
      )}

      {/* Preset Pill Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-[#67677e] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#1b55f5]" />
          Preset Kebijakan:
        </span>
        {Object.entries(PRESETS).map(([key, item]) => {
          const isActive = selectedPreset === key;
          return (
            <button
              key={key}
              onClick={() => handleApplyPreset(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border ${
                isActive
                  ? 'bg-[#1b55f5] text-white border-[#1b55f5] shadow-xs'
                  : 'bg-white hover:bg-[#f4f4f6] text-[#454554] border-[#d8d8df]'
              }`}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      {/* Grid: Controls Panel & Aggregate Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: 4D Weight Sliders & Cutoff (Span 2) */}
        <div className="lg:col-span-2 clean-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#e6e6ea]">
            <h3 className="text-xs font-bold text-[#000000] uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1b55f5]" />
              <span>Kalibrasi Bobot Penilaian 4D Deterministik</span>
            </h3>
            <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold ${
              totalWeightPercent === 100 
                ? 'bg-[#eaf0ff] text-[#1b55f5] border border-[#8ec0ff]' 
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              Total Alokasi: {totalWeightPercent}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Slider 1: S_comp */}
            <div className="p-4 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#000000]">S_comp (Keahlian & Core Skills)</span>
                  <p className="text-[10px] text-[#67677e]">Coverage taksonomi &amp; klaim teknis</p>
                </div>
                <span className="font-mono text-sm font-extrabold text-[#1b55f5] bg-white px-2 py-0.5 rounded-md border border-[#e6e6ea]">
                  {weights.comp}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={weights.comp}
                onChange={(e) => handleWeightChange('comp', e.target.value)}
                className="w-full accent-[#1b55f5] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#6C837C] font-mono">
                <span>0%</span>
                <span>Default: 40%</span>
                <span>80%</span>
              </div>
            </div>

            {/* Slider 2: S_port */}
            <div className="p-4 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#000000]">S_port (Repositori &amp; Kode GitHub)</span>
                  <p className="text-[10px] text-[#67677e]">Audit kode terverifikasi GitHub v3</p>
                </div>
                <span className="font-mono text-sm font-extrabold text-[#1b55f5] bg-white px-2 py-0.5 rounded-md border border-[#e6e6ea]">
                  {weights.port}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={weights.port}
                onChange={(e) => handleWeightChange('port', e.target.value)}
                className="w-full accent-[#1b55f5] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#67677e] font-mono">
                <span>0%</span>
                <span>Default: 20%</span>
                <span>60%</span>
              </div>
            </div>

            {/* Slider 3: S_conf */}
            <div className="p-4 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#000000]">S_conf (Keyakinan &amp; Linieritas)</span>
                  <p className="text-[10px] text-[#67677e]">Tingkat bukti faktual &amp; kronologi karier</p>
                </div>
                <span className="font-mono text-sm font-extrabold text-[#10B981] bg-white px-2 py-0.5 rounded-md border border-[#e6e6ea]">
                  {weights.conf}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={weights.conf}
                onChange={(e) => handleWeightChange('conf', e.target.value)}
                className="w-full accent-[#10B981] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#67677e] font-mono">
                <span>0%</span>
                <span>Default: 25%</span>
                <span>60%</span>
              </div>
            </div>

            {/* Slider 4: S_risk */}
            <div className="p-4 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#000000]">S_risk (Sensitivitas Anomali)</span>
                  <p className="text-[10px] text-[#67677e]">Ketegasan penalti overlap &amp; hidden text</p>
                </div>
                <span className="font-mono text-sm font-extrabold text-rose-600 bg-white px-2 py-0.5 rounded-md border border-[#e6e6ea]">
                  {weights.risk}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={weights.risk}
                onChange={(e) => handleWeightChange('risk', e.target.value)}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#67677e] font-mono">
                <span>0% (Longgar)</span>
                <span>Default: 15%</span>
                <span>50% (Ketat)</span>
              </div>
            </div>
          </div>

          {/* Dynamic Cutoff Threshold Slider */}
          <div className="p-4 rounded-xl bg-[#eaf0ff] border border-[#8ec0ff] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#1b55f5]" />
                <span className="text-xs font-bold text-[#000000]">
                  Ambang Batas Minimum Kelulusan (Passing Grade Cut-off)
                </span>
              </div>
              <span className="font-mono text-base font-extrabold text-[#1b55f5] bg-white px-3 py-0.5 rounded-lg border border-[#8ec0ff]">
                {cutoffScore} / 100
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="90"
              step="1"
              value={cutoffScore}
              onChange={(e) => setCutoffScore(Number(e.target.value))}
              className="w-full accent-[#1b55f5] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#454554] font-medium">
              <span>50 (Sangat Inklusif)</span>
              <span>Default PRD: 75</span>
              <span>85 (Standar Strong Match)</span>
              <span>90 (Elit)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Policy Impact Analytics Cards */}
        <div className="clean-card p-6 flex flex-col justify-between space-y-5">
          <div>
            <h3 className="text-xs font-bold text-[#000000] uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-[#e6e6ea]">
              <TrendingUp className="w-4 h-4 text-[#1b55f5]" />
              <span>Dampak Kebijakan (Hiring Impact)</span>
            </h3>

            <div className="mt-4 space-y-4">
              <div className="p-4 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea]">
                <span className="text-[10px] text-[#67677e] uppercase font-mono font-semibold">
                  Tingkat Kelulusan Ambang Batas
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-2xl font-extrabold text-[#000000]">
                    {stats.passRate}%
                  </div>
                  <span className="text-xs font-semibold text-[#1b55f5]">
                    {stats.passedCount} dari {stats.total} lolos
                  </span>
                </div>
                <div className="w-full bg-[#e6e6ea] h-2 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-[#1b55f5] h-full transition-all duration-300"
                    style={{ width: `${stats.passRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#eaf0ff] border border-[#8ec0ff]">
                  <span className="text-[10px] text-[#1b55f5] uppercase font-mono font-bold">Strong Match</span>
                  <div className="text-xl font-extrabold text-[#1b55f5] mt-0.5">{stats.strongCount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea]">
                  <span className="text-[10px] text-[#67677e] uppercase font-mono font-semibold">Rerata Skor</span>
                  <div className="text-xl font-extrabold text-[#000000] mt-0.5">{stats.avgScore}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f4f4f6] border border-[#e6e6ea] text-[11px] text-[#454554] leading-relaxed">
            <span className="font-bold text-[#000000] block mb-0.5">Penjelasan Formula PRD:</span>
            Skor total dihitung secara proporsional terhadap bobot normalisasi. Kandidat dengan anomali teks tersembunyi tetap dikarantina otomatis terlepas dari nilai skor.
          </div>
        </div>
      </div>

      {/* Main Real-Time Re-Ranked Table */}
      <div className="clean-card overflow-hidden">
        <div className="p-5 border-b border-[#e6e6ea] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
          <div>
            <h3 className="text-base font-bold font-display text-[#000000]">
              Tabel Re-Ranking Pelamar Waktu Nyata
            </h3>
            <p className="text-xs text-[#67677e]">
              Posisi antrean diperbarui seketika mengikuti pergeseran parameter slider di atas.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#67677e]">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>In-Memory Recomputed</span>
          </div>
        </div>

        {/* Mobile Scroll Indicator */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#f4f4f6] border-b border-[#e6e6ea] text-[11px] text-[#67677e] sm:hidden">
          <span>Geser tabel ke samping untuk melihat seluruh skor 4D</span>
          <span className="font-mono font-bold text-[#000000]">&rarr;</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#000000] min-w-[700px]">
            <thead className="bg-[#f4f4f6] border-b border-[#e6e6ea] text-[10px] font-bold uppercase font-mono text-[#67677e] tracking-wider">
              <tr>
                <th className="py-3 px-4 text-center">Rank</th>
                <th className="py-3 px-4">Kandidat Dossier</th>
                <th className="py-3 px-4">Pergeseran Skor</th>
                <th className="py-3 px-4">Rekomendasi Simulasi</th>
                <th className="py-3 px-4">Status Threshold ({cutoffScore})</th>
                <th className="py-3 px-4">Breakdown 4D Asli</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e6ea]">
              {simulatedList.map((c) => {
                const isRankUp = c.rankDelta > 0;
                const isRankDown = c.rankDelta < 0;
                const isScoreUp = c.scoreDelta > 0;
                const isScoreDown = c.scoreDelta < 0;

                return (
                  <tr 
                    key={c.id} 
                    className={`hover:bg-[#F6FAF7] transition-colors ${
                      c.isPassed ? 'bg-white' : 'bg-[#FAFCFA]/60 opacity-90'
                    }`}
                  >
                    {/* Rank Column */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-6 h-6 rounded-lg bg-[#0B2B26] text-white font-mono font-extrabold text-xs flex items-center justify-center">
                          {c.newRank}
                        </span>
                        {isRankUp && (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded" title={`Naik ${c.rankDelta} peringkat`}>
                            <ArrowUpRight className="w-3 h-3" />
                            +{c.rankDelta}
                          </span>
                        )}
                        {isRankDown && (
                          <span className="inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded" title={`Turun ${Math.abs(c.rankDelta)} peringkat`}>
                            <ArrowDownRight className="w-3 h-3" />
                            {c.rankDelta}
                          </span>
                        )}
                        {c.rankDelta === 0 && (
                          <span className="text-gray-400 text-[10px]" title="Posisi tetap">
                            <Minus className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Candidate Info */}
                    <td className="py-4 px-4">
                      <div className="font-mono font-bold text-[#0B2B26] text-xs">
                        {c.masked_identifier}
                      </div>
                      <div className="text-[11px] text-[#3D544E] font-medium">
                        {c.candidate_name_masked} &bull; <span className="text-[#6C837C]">{c.job_title}</span>
                      </div>
                      {c.flags.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-700 font-mono">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>{c.flags[0]}</span>
                        </div>
                      )}
                    </td>

                    {/* Score Shift */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-extrabold text-[#0B2B26] font-mono">
                          {c.simulatedScore}
                        </span>
                        <span className="text-[10px] text-[#6C837C] font-mono">
                          (Asli: {c.overall_score})
                        </span>
                      </div>
                      <div className="text-[10px] font-mono mt-0.5">
                        {isScoreUp && (
                          <span className="text-emerald-700 font-bold">+{c.scoreDelta} poin</span>
                        )}
                        {isScoreDown && (
                          <span className="text-rose-700 font-bold">{c.scoreDelta} poin</span>
                        )}
                        {c.scoreDelta === 0 && (
                          <span className="text-gray-500">Tetap (0.0)</span>
                        )}
                      </div>
                    </td>

                    {/* Recommendation */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                        c.newRec === 'STRONG_MATCH' 
                          ? 'bg-[#DAF1DE] text-[#0B2B26] border-[#C2E0C4]' 
                          : (c.newRec === 'SECURITY_QUARANTINE' 
                              ? 'bg-rose-50 text-rose-800 border-rose-200' 
                              : (c.newRec === 'REVIEW_REQUIRED' 
                                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                  : 'bg-gray-100 text-gray-700 border-gray-300'))
                      }`}>
                        {c.newRec === 'STRONG_MATCH' && <CheckCircle2 className="w-3 h-3 text-[#235347]" />}
                        {c.newRec === 'SECURITY_QUARANTINE' && <XCircle className="w-3 h-3 text-rose-600" />}
                        {c.newRec === 'REVIEW_REQUIRED' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                        <span>{c.newRec}</span>
                      </span>
                    </td>

                    {/* Threshold Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {c.isPassed ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span>Lulus Ambang Batas</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-100/60 border border-rose-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Di Bawah Cut-off</span>
                        </span>
                      )}
                    </td>

                    {/* Breakdown 4D */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="bg-[#EEF4F0] px-1.5 py-0.5 rounded border border-[#E1EBE4]" title="S_comp">
                          C: <strong>{c.scores_4d.s_comp}</strong>
                        </span>
                        <span className="bg-[#EEF4F0] px-1.5 py-0.5 rounded border border-[#E1EBE4]" title="S_port">
                          P: <strong>{c.scores_4d.s_port}</strong>
                        </span>
                        <span className="bg-[#EEF4F0] px-1.5 py-0.5 rounded border border-[#E1EBE4]" title="S_conf">
                          Cf: <strong>{c.scores_4d.s_conf}</strong>
                        </span>
                        <span className="bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200" title="S_risk">
                          R: <strong>{c.scores_4d.s_risk}</strong>
                        </span>
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
