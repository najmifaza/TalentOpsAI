import React from 'react';
import { ShieldCheck, Lock, CheckCircle2, X } from 'lucide-react';

export default function DpaModal({ isOpen, onClose, onAccept }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-black/70 backdrop-blur-md animate-fade-in select-none">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full border border-primary-border-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-jkt"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-black via-primary-slate-900 to-primary-slate-800 p-6 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-primary-orange/15 rounded-full blur-2xl"></div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-primary-orange/20 border border-primary-orange/40 flex items-center justify-center text-primary-orange shadow-inner">
              <ShieldCheck className="w-6 h-6 text-primary-orange" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">Data Processing Agreement (DPA)</h3>
              <p className="text-xs text-primary-slate-300">Kepatuhan Hukum UU Pelindungan Data Pribadi No. 27 Tahun 2022</p>
            </div>
          </div>
          <button 
            aria-label="Tutup ketentuan DPA"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors relative z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-primary-slate-700 leading-relaxed">
          <div className="p-4 rounded-2xl bg-primary-orange/5 border border-primary-orange/20 flex items-start gap-3">
            <Lock className="w-5 h-5 text-primary-orange shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-primary-black block">Jaminan Keamanan &amp; Kerahasiaan Kriptografis</span>
              <p className="text-primary-slate-600">
                TalentOps AI menerapkan arsitektur <em>Penyaringan LLM Zero-Knowledge</em>. Seluruh data identitas sensitif Anda (nama, email, nomor telepon, dan almamater) disensor sebelum diproses oleh model kecerdasan buatan.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-primary-black text-primary-orange border border-primary-slate-800 flex items-center justify-center text-xs font-extrabold shrink-0">
                1
              </div>
              <div>
                <h4 className="font-bold text-primary-black text-xs uppercase tracking-wider mb-1">
                  Enkripsi Berlapis (Envelope Encryption AES-256-GCM)
                </h4>
                <p className="text-xs text-primary-slate-600">
                  Data identitas pribadi Anda disimpan di basis data relasional MariaDB dengan enkripsi AES-256-GCM menggunakan Data Encryption Key (DEK) unik untuk setiap kandidat. DEK dilindungi Master Key KEK terpusat.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-primary-black text-primary-orange border border-primary-slate-800 flex items-center justify-center text-xs font-extrabold shrink-0">
                2
              </div>
              <div>
                <h4 className="font-bold text-primary-black text-xs uppercase tracking-wider mb-1">
                  Sanitasi PII In-Memory &amp; Eliminasi Bias Demografis
                </h4>
                <p className="text-xs text-primary-slate-600">
                  Model AI (Gemini 3.8) hanya menerima teks resume yang telah disanitasi dari entitas nama, gender, usia, kontak, dan kampus almamater guna mencegah diskriminasi ras, gender, maupun universitas asal.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-primary-black text-primary-orange border border-primary-slate-800 flex items-center justify-center text-xs font-extrabold shrink-0">
                3
              </div>
              <div>
                <h4 className="font-bold text-primary-black text-xs uppercase tracking-wider mb-1">
                  Pelacakan Anonim via Secret Tracking Token (UUIDv4)
                </h4>
                <p className="text-xs text-primary-slate-600">
                  Status lamaran Anda dilacak menggunakan token acak 128-bit (UUIDv4) dan identifier publik bertopeng (<code className="bg-primary-slate-100 px-1.5 py-0.5 rounded text-primary-black border border-primary-border-200 font-mono text-[11px]">#TK-XXXXXX</code>) untuk mencegah pelacakan berurutan (<em>sequential enumeration</em>) oleh pihak luar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-primary-black text-primary-orange border border-primary-slate-800 flex items-center justify-center text-xs font-extrabold shrink-0">
                4
              </div>
              <div>
                <h4 className="font-bold text-primary-black text-xs uppercase tracking-wider mb-1">
                  Hak Penghapusan Data (Right to Erasure &amp; Crypto-Shredding)
                </h4>
                <p className="text-xs text-primary-slate-600">
                  Sesuai Pasal 39 UU PDP No. 27/2022, Anda berhak mencabut persetujuan dan meminta penghapusan total data Anda kapan saja. Sistem akan menghancurkan DEK secara kriptografis (*crypto-shredding*) sehingga data tidak dapat didekripsi kembali selamanya.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-primary-border-100 bg-primary-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-primary-border-200 text-primary-slate-700 hover:bg-white text-xs font-bold transition-all"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              if (onAccept) onAccept();
              onClose();
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-orange hover:bg-primary-orange-dark text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>Saya Memahami &amp; Menyetujui Ketentuan DPA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
