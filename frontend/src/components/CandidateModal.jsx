import React from 'react';
import { 
  X, 
  ShieldCheck, 
  Github, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Code2,
  FileText,
  KeyRound
} from 'lucide-react';

export default function CandidateModal({ candidate, onClose }) {
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-cyan-400">
                {candidate.masked_identifier}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {candidate.candidate_name_masked}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Melamar untuk: <span className="text-slate-200 font-medium">{candidate.job_title}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
          {/* UU PDP Security Notice */}
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-cyan-300">Kepatuhan UU PDP No. 27/2022:</span>
              <p className="text-slate-400 mt-0.5 leading-relaxed">
                Identitas PII (nama asli, email, telepon, almamater) disanitasi & dienkripsi AES-256-GCM. 
                Token pelacakan anonim pelamar: <code className="text-cyan-400 font-mono text-[11px] bg-cyan-900/30 px-1 py-0.5 rounded">{candidate.tracking_token}</code>
              </p>
            </div>
          </div>

          {/* 4D Scoring Grid */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Breakdown Skor 4D Deterministik
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono">S_comp (Keahlian)</span>
                <div className="text-lg font-bold text-cyan-400 mt-0.5">{candidate.scores_4d.s_comp}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono">S_port (GitHub Repo)</span>
                <div className="text-lg font-bold text-blue-400 mt-0.5">{candidate.scores_4d.s_port}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono">S_conf (Keyakinan)</span>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{candidate.scores_4d.s_conf}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono">S_risk (Penalti)</span>
                <div className="text-lg font-bold text-rose-400 mt-0.5">{candidate.scores_4d.s_risk}</div>
              </div>
            </div>
          </div>

          {/* Key Technologies */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Keahlian & Taksonomi Teknologi
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {candidate.key_technologies.map((tech, idx) => (
                <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700/60 font-mono">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Anomaly & Risk Flags */}
          {candidate.flags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">
                Peringatan Anomali & Manipulasi
              </h4>
              <div className="space-y-1.5">
                {candidate.flags.map((flag, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span className="font-mono">{flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Rekomendasi Keputusan AI: <strong className="text-slate-200">{candidate.recommendation}</strong>
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  alert(`[Simulasi Review HR]: Kandidat ${candidate.masked_identifier} dijadwalkan wawancara (Atomic Calendar Lock).`);
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                Approve & Schedule
              </button>
              <button
                onClick={() => {
                  alert(`[Simulasi Review HR]: Kandidat ${candidate.masked_identifier} ditolak.`);
                  onClose();
                }}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs rounded-xl border border-rose-500/30 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
