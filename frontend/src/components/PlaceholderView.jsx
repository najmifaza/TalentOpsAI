import React from 'react';
import { GitBranch, Sliders, ShieldAlert, Sparkles, Layers } from 'lucide-react';

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
    <div className="p-8 rounded-[2rem] clean-card text-center max-w-2xl mx-auto my-12 space-y-6 shadow-md">
      <div className="w-16 h-16 rounded-2xl bg-[#DAF1DE] text-[#0B2B26] mx-auto flex items-center justify-center border border-[#C2E0C4]">
        <Icon className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-xs px-3 py-1 rounded-full bg-[#DAF1DE] text-[#0B2B26] border border-[#C2E0C4] font-bold">
          Rencana Pengembangan: {item.sprint}
        </span>
        <h3 className="text-xl font-bold text-[#0B201B]">{item.title}</h3>
        <p className="text-xs text-[#6C837C] leading-relaxed max-w-lg mx-auto font-medium">
          {item.desc}
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-[#F6FAF7] border border-[#E1EBE4] text-left space-y-2.5">
        <span className="text-xs font-bold text-[#0B201B] uppercase tracking-wider">
          Spesifikasi Teknis PRD v2.5.2:
        </span>
        <ul className="space-y-2 text-xs text-[#3D544E]">
          {item.features.map((feat, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5 shrink-0"></span>
              <span className="font-medium">{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-[#6C837C]">
        Fokus pengerjaan Sprint 1 saat ini adalah validasi <strong>Walking Skeleton</strong> integrasi live Vercel &rarr; VPS MariaDB.
      </p>
    </div>
  );
}
