import React from 'react';
import { ShieldCheck, Lock, EyeOff, Trash2, CheckCircle2, X } from 'lucide-react';

export default function DpaModal({ isOpen, onClose, onAccept }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#051F20]/70 backdrop-blur-sm animate-fade-in select-none">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full border border-[#E1EBE4] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0B2B26] to-[#163832] p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8EB69B]/20 border border-[#8EB69B]/30 flex items-center justify-center text-[#DAF1DE]">
              <ShieldCheck className="w-6 h-6 text-[#8EB69B]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Data Processing Agreement (DPA)</h3>
              <p className="text-xs text-[#8EB69B]">Kepatuhan Hukum UU Pelindungan Data Pribadi No. 27 Tahun 2022</p>
            </div>
          </div>
          <button 
            aria-label="Tutup ketentuan DPA"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-[#3D544E] leading-relaxed">
          <div className="p-4 rounded-2xl bg-[#EEF4F0] border border-[#C2E0C4] flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#235347] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-[#0B201B] block">Jaminan Keamanan & Kerahasiaan Kriptografis</span>
              <p className="text-[#3D544E]">
                TalentOps AI menerapkan arsitektur <em>Penyaringan LLM Zero-Knowledge</em>. Seluruh data identitas sensitif Anda (nama, email, nomor telepon, dan almamater) disensor sebelum diproses oleh model kecerdasan buatan.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#0B2B26] text-[#8EB69B] flex items-center justify-center text-xs font-bold shrink-0">
                1
              </div>
              <div>
                <h4 className="font-bold text-[#0B201B] text-xs uppercase tracking-wider mb-1">
                  Enkripsi Berlapis (Envelope Encryption AES-256-GCM)
                </h4>
                <p className="text-xs text-[#6C837C]">
                  Data identitas pribadi Anda disimpan di basis data relasional MariaDB dengan enkripsi AES-256-GCM menggunakan Data Encryption Key (DEK) unik untuk setiap kandidat. DEK dilindungi Master Key KEK terpusat.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#0B2B26] text-[#8EB69B] flex items-center justify-center text-xs font-bold shrink-0">
                2
              </div>
              <div>
                <h4 className="font-bold text-[#0B201B] text-xs uppercase tracking-wider mb-1">
                  Sanitasi PII In-Memory & Eliminasi Bias Demografis
                </h4>
                <p className="text-xs text-[#6C837C]">
                  Model AI (Gemini 3.8) hanya menerima teks resume yang telah disanitasi dari entitas nama, gender, usia, kontak, dan kampus almamater guna mencegah diskriminasi ras, gender, maupun universitas asal.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#0B2B26] text-[#8EB69B] flex items-center justify-center text-xs font-bold shrink-0">
                3
              </div>
              <div>
                <h4 className="font-bold text-[#0B201B] text-xs uppercase tracking-wider mb-1">
                  Pelacakan Anonim via Secret Tracking Token (UUIDv4)
                </h4>
                <p className="text-xs text-[#6C837C]">
                  Status lamaran Anda dilacak menggunakan token acak 128-bit (UUIDv4) dan identifier publik bertopeng (<code className="bg-[#E1EBE4] px-1 py-0.5 rounded text-[#051F20]">#TK-XXXXXX</code>) untuk mencegah pelacakan berurutan (<em>sequential enumeration</em>) oleh pihak luar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#0B2B26] text-[#8EB69B] flex items-center justify-center text-xs font-bold shrink-0">
                4
              </div>
              <div>
                <h4 className="font-bold text-[#0B201B] text-xs uppercase tracking-wider mb-1">
                  Hak Penghapusan Data (Right to Erasure & Crypto-Shredding)
                </h4>
                <p className="text-xs text-[#6C837C]">
                  Sesuai Pasal 39 UU PDP No. 27/2022, Anda berhak mencabut persetujuan dan meminta penghapusan total data Anda kapan saja. Sistem akan menghancurkan DEK secara kriptografis (*crypto-shredding*) sehingga data tidak dapat didekripsi kembali selamanya.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-[#E1EBE4] bg-[#EEF4F0]/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#C2E0C4] text-[#3D544E] hover:bg-white text-xs font-semibold transition-all"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              if (onAccept) onAccept();
              onClose();
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0B2B26] hover:bg-[#163832] text-white rounded-xl text-xs font-semibold shadow-md transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-[#8EB69B]" />
            <span>Saya Memahami & Menyetujui Ketentuan DPA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
