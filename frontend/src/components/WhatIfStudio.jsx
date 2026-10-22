import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sliders, ArrowLeft, RefreshCw, ShieldAlert, TrendingUp, TrendingDown, Minus, Sparkles, Gauge } from 'lucide-react';
import { recLabel } from '../lib/labels';
import WeightSliders from './WeightSliders';
import { toPercent, toRatio, DEFAULT_WEIGHT_PCT } from '../lib/dimensions';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-talentops.fawt.biz.id';

const BUCKETS = [
  { key: 'STRONG_MATCH', label: recLabel('STRONG_MATCH'), cls: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
  { key: 'REVIEW_REQUIRED', label: recLabel('REVIEW_REQUIRED'), cls: 'text-primary-blue bg-primary-blue/10 border-primary-blue/30' },
  { key: 'WEAK_FIT', label: recLabel('WEAK_FIT'), cls: 'text-rose-700 bg-rose-50 border-rose-200' },
];

export default function WhatIfStudio() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHT_PCT);
  // Start at the production cut-off so the first run isolates the weight effect;
  // lowering it afterwards shows what loosening the policy would let through.
  const [cutoff, setCutoff] = useState(85);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
      if (!res.ok) throw new Error(`Lowongan tidak ditemukan (${res.status})`);
      const data = await res.json();
      setJob(data);
      setWeights(toPercent(data.weight_config));
    } catch (err) {
      setError(err.message);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const runSimulation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/simulate-policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weights: toRatio(weights),
          min_overall_score: cutoff,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `Simulasi gagal (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, weights, cutoff]);

  // Debounced live re-run: the endpoint is pure in-memory, so dragging a slider can re-score instantly.
  useEffect(() => {
    const t = setTimeout(runSimulation, 350);
    return () => clearTimeout(t);
  }, [runSimulation]);

  const summary = result?.summary;
  const ranking = result?.ranking || [];
  const movedCount = useMemo(
    () => ranking.filter((c) => c.baseline.recommendation !== c.simulated.recommendation).length,
    [ranking]
  );

  return (
    <div className="space-y-6 pb-12 font-jkt">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-primary-border-200 p-6 shadow-sm relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.03] bg-dot-matrix pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-orange/10 text-primary-black text-xs font-semibold border border-primary-orange/30">
              <Sliders className="w-3.5 h-3.5 text-primary-orange" />
              <span className="font-bold tracking-wider uppercase text-[11px]">Simulasi Kebijakan Rekrutmen</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-primary-black tracking-tight leading-tight">
              {job ? job.title : 'Simulasi Kebijakan Rekrutmen'}
            </h2>
            <p className="text-xs text-primary-slate-600 leading-relaxed">
              {job ? `${job.department} · ` : ''}
              Re-skor kandidat di memori tanpa memanggil ulang LLM dan tanpa mengubah data tersimpan.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-primary-border-200 text-primary-slate-700 text-xs font-bold hover:border-primary-orange hover:text-primary-orange transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
            <button
              onClick={runSimulation}
              disabled={isLoading}
              className="p-2.5 rounded-full bg-white border border-primary-border-200 text-primary-slate-700 hover:border-primary-orange hover:text-primary-orange transition-all"
              title="Jalankan ulang simulasi"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary-orange' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sliders */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-primary-border-200 p-5 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-extrabold text-primary-black tracking-tight">Bobot Dimensi 4D</h3>
            <p className="text-[11px] text-primary-slate-500 mt-0.5">Total selalu 100%. Angka di bawah slider adalah nilai yang dipakai simulasi.</p>
          </div>
          <WeightSliders weights={weights} onChange={setWeights} />

          <div className="pt-4 border-t border-primary-border-100 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="cutoff" className="font-semibold text-primary-black flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-primary-orange" />
                Passing Grade
              </label>
              <span className="font-mono font-bold text-primary-orange tabular-nums">{cutoff.toFixed(0)}</span>
            </div>
            <input
              id="cutoff"
              type="range"
              min="50"
              max="90"
              step="1"
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
              className="w-full accent-primary-orange cursor-pointer"
            />
            <p className="text-[11px] text-primary-slate-500 leading-snug">
              Ambang STRONG_MATCH. Kebijakan produksi memakai 85; turunkan untuk melihat siapa yang ikut lolos.
            </p>
          </div>

          <div className="pt-3 border-t border-primary-border-100 text-[11px] text-primary-slate-500 leading-relaxed">
            <span className="font-semibold text-primary-black">Catatan:</span> simulasi read-only. Bobot lowongan
            tersimpan tidak berubah sampai Anda menekan Simpan di halaman Kelola Lowongan.
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Distribution */}
          <div className="bg-white rounded-2xl border border-primary-border-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-primary-black tracking-tight">Pergeseran Distribusi</h3>
              <span className="text-[11px] font-semibold text-primary-slate-500">
                {summary ? `${summary.total_evaluated_candidates} kandidat · ${movedCount} berubah kategori` : 'Belum ada data'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {BUCKETS.map((b) => {
                const base = summary?.baseline_distribution?.[b.key] ?? 0;
                const sim = summary?.simulated_distribution?.[b.key] ?? 0;
                const delta = summary?.distribution_delta?.[b.key] ?? 0;
                return (
                  <div key={b.key} className={`rounded-xl border p-3.5 ${b.cls}`}>
                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{b.label}</p>
                    <div className="flex items-end gap-2 mt-1">
                      <span className="text-2xl font-extrabold tabular-nums text-primary-black">{sim}</span>
                      <span className="text-[11px] font-semibold text-primary-slate-500 mb-1 tabular-nums">dari {base}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold mt-1">
                      {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      <span className="tabular-nums">{delta > 0 ? `+${delta}` : delta}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranking table */}
          <div className="bg-white rounded-2xl border border-primary-border-200 shadow-sm overflow-hidden">
            <div className="p-5 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-primary-black tracking-tight">Peringkat Ulang Kandidat</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-slate-500">
                <Sparkles className="w-3 h-3 text-primary-orange" />
                Zero LLM re-call
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-primary-slate-50 text-primary-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold">#</th>
                    <th className="px-4 py-2.5 text-left font-bold">Kandidat</th>
                    <th className="px-4 py-2.5 text-right font-bold">Baseline</th>
                    <th className="px-4 py-2.5 text-right font-bold">Simulasi</th>
                    <th className="px-4 py-2.5 text-right font-bold">Delta</th>
                    <th className="px-4 py-2.5 text-left font-bold">Rekomendasi Simulasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-border-100">
                  {ranking.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-primary-slate-500">
                        {isLoading ? 'Menghitung ulang skor kandidat...' : 'Belum ada kandidat ter-triage pada lowongan ini.'}
                      </td>
                    </tr>
                  )}
                  {ranking.map((c, i) => {
                    const changed = c.baseline.recommendation !== c.simulated.recommendation;
                    return (
                      <tr key={c.id} className={changed ? 'bg-primary-orange/5' : ''}>
                        <td className="px-4 py-2.5 text-primary-slate-400 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-primary-black">
                          {c.masked_identifier}
                          {c.is_quarantined && (
                            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              <ShieldAlert className="w-2.5 h-2.5" /> Karantina
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-primary-slate-600">
                          {c.baseline.overall_score.toFixed(1)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-primary-black">
                          {c.simulated.overall_score.toFixed(1)}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                          c.simulated.delta_score > 0 ? 'text-emerald-700' : c.simulated.delta_score < 0 ? 'text-rose-700' : 'text-primary-slate-400'
                        }`}>
                          {c.simulated.delta_score > 0 ? `+${c.simulated.delta_score.toFixed(1)}` : c.simulated.delta_score.toFixed(1)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-primary-black">{recLabel(c.simulated.recommendation)}</span>
                            <span className="text-[10px] text-primary-slate-500">
                              {changed ? `sebelumnya ${recLabel(c.baseline.recommendation)} · ` : ''}{c.simulated.rule_applied}
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
      </div>
    </div>
  );
}
