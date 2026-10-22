import React from 'react';
import { UploadCloud, Sparkles, CalendarCheck, ChevronRight } from 'lucide-react';

// Dashboard dibuka dengan tiga judul bertumpuk (breadcrumb Header + badge hero +
// H2) yang tidak menjelaskan urutan kerja. Strip ini menggantikannya: satu baris
// yang menyebut tiga langkah nyata beserta berapa yang menunggu di tiap langkah.
// Badge hanya muncul kalau ada angka yang bisa dilaporkan — "selesai" saat antrean
// masih kosong adalah klaim palsu.
export default function WorkflowStrip({ unscannedCount = 0, reviewCount = 0, onUpload }) {
  const steps = [
    { key: 'upload', icon: UploadCloud, title: 'Unggah Berkas', detail: 'CV PDF/DOCX masuk antrean', onClick: onUpload },
    { key: 'triage', icon: Sparkles, title: 'Penyaringan AI', detail: 'Ekstraksi bukti & skor 4D', count: unscannedCount, label: 'menunggu' },
    { key: 'review', icon: CalendarCheck, title: 'Review & Jadwalkan', detail: 'Validasi HR lalu kunci slot', count: reviewCount, label: 'perlu review' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-primary-border-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-primary-border-100">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const hasCount = typeof step.count === 'number' && step.count > 0;
          const Wrapper = step.onClick ? 'button' : 'div';
          return (
            <Wrapper
              key={step.key}
              {...(step.onClick ? { type: 'button', onClick: step.onClick } : {})}
              className={`flex items-center gap-3 p-4 text-left transition-colors ${
                step.onClick ? 'hover:bg-primary-slate-50 cursor-pointer' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-primary-slate-100 border border-primary-border-200 flex items-center justify-center shrink-0 relative">
                <Icon className="w-4 h-4 text-primary-black" />
                <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-primary-black text-white text-[9px] font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-primary-black truncate">{step.title}</p>
                <p className="text-[11px] text-primary-slate-500 truncate">{step.detail}</p>
              </div>
              {hasCount ? (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums bg-primary-orange/10 text-primary-orange border-primary-orange/30">
                  {step.count} {step.label}
                </span>
              ) : (
                idx < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-primary-slate-300 shrink-0" />
              )}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
