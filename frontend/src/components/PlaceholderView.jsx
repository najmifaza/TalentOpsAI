import React from 'react';
import { GitBranch, Sliders, ShieldAlert, Sparkles, Calendar, Layers } from 'lucide-react';

export default function PlaceholderView({ tabId }) {
  const configs = {
    'evidence-graph': {
      title: 'Candidate Evidence Graph (React Flow)',
      sprint: 'Sprint 2 - 3',
      icon: GitBranch,
      desc: 'Visualisasi graf node interaktif yang menghubungkan klaim kompetensi resume secara langsung ke kutipan narasi terverifikasi dan metadata repositori GitHub.',
      features: [
        'Node kustom React Flow untuk keahlian, pengalaman, dan bukti GitHub',
        'Penanganan role non-programmer (Badge NOT_APPLICABLE tanpa error merah)',
        'Trace interkoneksi langsung ke verifikasi API GitHub v3'
      ]
    },
    'what-if': {
      title: 'What-If Policy Simulation Studio',
      sprint: 'Sprint 3',
      icon: Sliders,
      desc: 'Studio simulasi parameter kebijakan rekrutmen in-memory. HR dapat menggeser bobot penilaian 4D secara real-time dan melihat pergeseran urutan kandidat seketika.',
      features: [
        'Slider bobot interaktif S_comp, S_port, S_conf, S_risk',
        'Re-ranking tabel kandidat tanpa latensi LLM backend',
        'Simulasi threshold minimum kelulusan (cut-off score 75.0)'
      ]
    },
    'security-pdp': {
      title: 'UU PDP No. 27/2022 & Right to Erasure Guard',
      sprint: 'Sprint 3',
      icon: ShieldAlert,
      desc: 'Pusat manajemen kepatuhan privasi data. Perlindungan hak kandidat untuk penarikan lamaran dan penghancuran DEK (Data Encryption Key) secara kriptografis.',
      features: [
        'Soft-deletion kriptografis via DELETE /api/candidates/{id}',
        'In-Memory Regex PII Sanitizer (< 20 ms latensi)',
        'Blind Indexing HMAC-SHA256 untuk pencarian tanpa dekripsi identitas'
      ]
    }
  };

  const item = configs[tabId] || configs['evidence-graph'];
  const Icon = item.icon;

  return (
    <div className="p-8 rounded-2xl glass-panel border border-slate-800 text-center max-w-2xl mx-auto my-12 space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center">
        <Icon className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-medium">
          Rencana Pengembangan: {item.sprint}
        </span>
        <h3 className="text-xl font-bold text-slate-100">{item.title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
          {item.desc}
        </p>
      </div>

      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-left space-y-2.5">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Spesifikasi Teknis PRD v2.5.2:
        </span>
        <ul className="space-y-2 text-xs text-slate-400">
          {item.features.map((feat, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0"></span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-500">
        Fokus pengerjaan Sprint 1 saat ini adalah validasi <strong>Walking Skeleton</strong> integrasi live Vercel &rarr; VPS MariaDB.
      </p>
    </div>
  );
}
