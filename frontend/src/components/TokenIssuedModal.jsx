import React, { useState } from 'react';
import { 
  CheckCircle, 
  KeyRound, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle,
  FileText
} from 'lucide-react';

export default function TokenIssuedModal({ 
  isOpen, 
  onClose, 
  maskedIdentifier, 
  trackingToken, 
  jobTitle,
  piiStats,
  onTrackNow 
}) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showToken, setShowToken] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#051F20]/75 backdrop-blur-md animate-fade-in select-none">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full border border-[#C2E0C4] shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Header */}
        <div className="p-6 pb-4 bg-gradient-to-br from-[#0B2B26] via-[#163832] to-[#235347] text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-[#8EB69B]/10 rounded-full blur-2xl"></div>
          
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#8EB69B] to-[#DAF1DE] flex items-center justify-center shadow-lg text-[#051F20] mb-3">
            <CheckCircle className="w-8 h-8 text-[#0B2B26]" />
          </div>

          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Berkas Lamaran Berhasil Diterima!
          </h3>
          <p className="text-xs text-[#8EB69B] mt-1">
            Tersimpan aman & telah disanitasi untuk posisi <span className="font-semibold text-white">{jobTitle || 'Lowongan Kerja'}</span>
          </p>
        </div>

        {/* Credentials & Tokens Container */}
        <div className="p-6 space-y-4">
          {/* Privacy Security Note */}
          <div className="p-3.5 rounded-2xl bg-[#EEF4F0] border border-[#C2E0C4] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#235347] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#3D544E] leading-relaxed">
              Data Anda telah dienkripsi menggunakan <strong>AES-256-GCM</strong> dan identitas telah disanitasi dari bias gender, almamater, dan kontak sebelum dianalisis model AI.
            </p>
          </div>

          {/* Masked Public Identifier Card */}
          <div className="p-3.5 rounded-xl border border-[#E1EBE4] bg-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6C837C] block mb-1">
              Public Masked Identifier (ID Publik Display)
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-extrabold text-[#0B2B26] tracking-wider">
                {maskedIdentifier || '#TK-XXXXXX'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(maskedIdentifier, 'id')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEF4F0] hover:bg-[#C2E0C4]/50 text-xs font-semibold text-[#0B2B26] transition-colors"
              >
                {copiedId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#235347]" />
                    <span>Salin ID</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-[#6C837C] mt-1">
              ID ini digunakan dalam komunikasi umum tanpa membuka identitas asli Anda.
            </p>
          </div>

          {/* Secret Tracking Token Box (The High-Entropy UUID) */}
          <div className="p-4 rounded-2xl bg-[#051F20] text-white border border-[#163832] shadow-inner space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#8EB69B]">
                <KeyRound className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Secret Tracking Token (UUIDv4)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[10px] flex items-center gap-1 text-[#8EB69B]/80 hover:text-[#DAF1DE] transition-colors"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showToken ? 'Sembunyikan' : 'Perlihatkan'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0B2B26] border border-[#163832]">
              <span className="font-mono text-xs text-[#DAF1DE] truncate font-medium">
                {showToken ? trackingToken : (trackingToken ? `${trackingToken.slice(0, 8)}••••••••••••••••••••••••` : '••••••••••••••••••••••••')}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(trackingToken, 'token')}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#8EB69B] hover:bg-[#A3C7AF] text-[#051F20] font-bold text-xs shadow transition-all"
              >
                {copiedToken ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#051F20]" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#051F20]" />
                    <span>Salin Token</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-start gap-1.5 pt-1 text-[10px] text-[#8EB69B]/80">
              <AlertCircle className="w-3.5 h-3.5 text-[#8EB69B] shrink-0 mt-0.5" />
              <p>
                <strong>PENTING:</strong> Simpan token ini! Anda membutuhkannya untuk memantau status lamaran atau mengajukan <em>Right to Erasure</em>.
              </p>
            </div>
          </div>

          {/* Sanitization Summary Badge if available */}
          {piiStats && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#EEF4F0] border border-[#E1EBE4] text-[11px] text-[#3D544E] flex items-center justify-between">
              <span className="font-medium text-[#6C837C]">Audit Sanitasi PII:</span>
              <span className="font-semibold text-[#0B2B26] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                {piiStats.total_replacements || 0} entitas identitas disensor otomatis
              </span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-6 pt-2 pb-6 border-t border-[#E1EBE4] flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/2 py-2.5 rounded-xl border border-[#C2E0C4] text-[#3D544E] hover:bg-[#EEF4F0] text-xs font-semibold transition-all text-center"
          >
            Selesai & Tutup
          </button>
          
          <button
            type="button"
            onClick={() => {
              if (onTrackNow) onTrackNow(trackingToken);
              onClose();
            }}
            className="w-full sm:w-1/2 py-2.5 rounded-xl bg-[#0B2B26] hover:bg-[#163832] text-white text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <span>Lacak Status Sekarang</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#8EB69B]" />
          </button>
        </div>
      </div>
    </div>
  );
}
