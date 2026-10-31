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
  AlertCircle 
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-black/70 backdrop-blur-md animate-fade-in select-none">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full border border-primary-border-200 shadow-2xl overflow-hidden flex flex-col animate-scale-up font-jkt"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Header */}
        <div className="p-6 pb-5 bg-gradient-to-br from-primary-black via-primary-slate-900 to-primary-slate-800 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-primary-orange/15 rounded-full blur-2xl"></div>
          
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-orange/20 border border-primary-orange/30 flex items-center justify-center shadow-lg text-primary-orange mb-3">
            <CheckCircle className="w-8 h-8 text-primary-orange" />
          </div>

          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Berkas Lamaran Berhasil Diterima!
          </h3>
          <p className="text-xs text-primary-slate-300 mt-1">
            Tersimpan aman &amp; telah disanitasi untuk posisi <span className="font-semibold text-white">{jobTitle || 'Lowongan Kerja'}</span>
          </p>
        </div>

        {/* Credentials & Tokens Container */}
        <div className="p-6 space-y-4">
          {/* Privacy Security Note */}
          <div className="p-3.5 rounded-2xl bg-primary-orange/5 border border-primary-orange/20 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary-orange shrink-0 mt-0.5" />
            <p className="text-[11px] text-primary-slate-700 leading-relaxed">
              Data Anda telah dienkripsi menggunakan <strong>AES-256-GCM</strong> dan identitas telah disanitasi dari bias gender, almamater, dan kontak sebelum dianalisis model AI.
            </p>
          </div>

          {/* Masked Public Identifier Card */}
          <div className="p-3.5 rounded-xl border border-primary-border-200 bg-primary-slate-50/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-500 block mb-1">
              Public Masked Identifier (ID Publik Display)
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-extrabold text-primary-black tracking-wider">
                {maskedIdentifier || '#TK-XXXXXX'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(maskedIdentifier, 'id')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-primary-border-200 hover:border-primary-orange text-xs font-semibold text-primary-slate-700 hover:text-primary-orange transition-colors shadow-2xs"
              >
                {copiedId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-primary-orange" />
                    <span className="text-primary-orange font-bold">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-primary-slate-500" />
                    <span>Salin ID</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-primary-slate-500 mt-1">
              ID ini digunakan dalam komunikasi umum tanpa membuka identitas asli Anda.
            </p>
          </div>

          {/* Secret Tracking Token Box (The High-Entropy UUID) */}
          <div className="p-4 rounded-2xl bg-primary-black text-white border border-primary-slate-800 shadow-inner space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-primary-orange">
                <KeyRound className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-slate-300">
                  Secret Tracking Token (UUIDv4)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[10px] flex items-center gap-1 text-primary-slate-400 hover:text-primary-slate-200 transition-colors"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showToken ? 'Sembunyikan' : 'Perlihatkan'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-primary-slate-900 border border-primary-slate-800">
              <span className="font-mono text-xs text-primary-slate-100 truncate font-medium">
                {showToken ? trackingToken : (trackingToken ? `${trackingToken.slice(0, 8)}••••••••••••••••••••••••` : '••••••••••••••••••••••••')}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(trackingToken, 'token')}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-orange hover:bg-primary-orange-dark text-white font-bold text-xs shadow transition-all"
              >
                {copiedToken ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-white" />
                    <span>Salin Token</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-start gap-1.5 pt-1 text-[10px] text-primary-slate-400">
              <AlertCircle className="w-3.5 h-3.5 text-primary-orange shrink-0 mt-0.5" />
              <p>
                <strong className="text-primary-slate-200">PENTING:</strong> Simpan token ini! Anda membutuhkannya untuk memantau status lamaran atau mengajukan <em>Right to Erasure</em>.
              </p>
            </div>
          </div>

          {/* Sanitization Summary Badge if available */}
          {piiStats && (
            <div className="px-3.5 py-2.5 rounded-xl bg-primary-slate-50 border border-primary-border-200 text-[11px] text-primary-slate-700 flex items-center justify-between">
              <span className="font-medium text-primary-slate-500">Audit Sanitasi PII:</span>
              <span className="font-semibold text-primary-black flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-primary-orange" />
                {piiStats.total_replacements || 0} entitas identitas disensor otomatis
              </span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-6 pt-2 pb-6 border-t border-primary-border-100 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/2 py-2.5 rounded-xl border border-primary-border-200 text-primary-slate-700 hover:bg-primary-slate-50 text-xs font-bold transition-all text-center"
          >
            Selesai &amp; Tutup
          </button>
          
          <button
            type="button"
            onClick={() => {
              if (onTrackNow) onTrackNow(trackingToken);
              onClose();
            }}
            className="w-full sm:w-1/2 py-2.5 rounded-xl bg-primary-orange hover:bg-primary-orange-dark text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <span>Lacak Status Sekarang</span>
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
