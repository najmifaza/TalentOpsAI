import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  GitBranch
} from 'lucide-react';

export default function CandidateModal({ candidate, onClose }) {
  const navigate = useNavigate();
  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#051F20]/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E1EBE4] rounded-[2rem] max-w-2xl w-full p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E1EBE4]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-[#0B2B26]">
                {candidate.masked_identifier}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#DAF1DE] text-[#0B2B26] font-semibold border border-[#C2E0C4]">
                {candidate.candidate_name_masked}
              </span>
            </div>
            <p className="text-xs text-[#6C837C] mt-1 font-medium">
              Melamar untuk: <span className="text-[#0B201B] font-semibold">{candidate.job_title}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6C837C] hover:text-[#0B201B] hover:bg-[#EEF4F0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
          {/* UU PDP Security Notice */}
          <div className="p-3.5 rounded-2xl bg-[#DAF1DE]/70 border border-[#C2E0C4] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0B2B26] shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-[#0B2B26]">Kepatuhan UU PDP No. 27/2022:</span>
              <p className="text-[#3D544E] mt-0.5 leading-relaxed">
                Identitas PII (nama asli, email, telepon, almamater) disanitasi & dienkripsi AES-256-GCM. 
                Token pelacakan anonim pelamar: <code className="text-[#0B2B26] font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#C2E0C4]">{candidate.tracking_token}</code>
              </p>
            </div>
          </div>

          {/* 4D Scoring Grid */}
          <div>
            <h4 className="text-xs font-bold text-[#6C837C] uppercase tracking-wider mb-2.5">
              Breakdown Skor 4D Deterministik
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#F6FAF7] border border-[#E1EBE4] text-center">
                <span className="text-[10px] text-[#6C837C] uppercase font-mono font-semibold">S_comp (Keahlian)</span>
                <div className="text-xl font-extrabold text-[#0B2B26] mt-0.5">{candidate.scores_4d.s_comp}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F6FAF7] border border-[#E1EBE4] text-center">
                <span className="text-[10px] text-[#6C837C] uppercase font-mono font-semibold">S_port (GitHub)</span>
                <div className="text-xl font-extrabold text-[#235347] mt-0.5">{candidate.scores_4d.s_port}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F6FAF7] border border-[#E1EBE4] text-center">
                <span className="text-[10px] text-[#6C837C] uppercase font-mono font-semibold">S_conf (Keyakinan)</span>
                <div className="text-xl font-extrabold text-[#10B981] mt-0.5">{candidate.scores_4d.s_conf}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F6FAF7] border border-[#E1EBE4] text-center">
                <span className="text-[10px] text-[#6C837C] uppercase font-mono font-semibold">S_risk (Penalti)</span>
                <div className="text-xl font-extrabold text-rose-600 mt-0.5">{candidate.scores_4d.s_risk}</div>
              </div>
            </div>
          </div>

          {/* Key Technologies */}
          <div>
            <h4 className="text-xs font-bold text-[#6C837C] uppercase tracking-wider mb-2">
              Keahlian & Taksonomi Teknologi
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {candidate.key_technologies.map((tech, idx) => (
                <span key={idx} className="text-xs px-3 py-1 rounded-xl bg-[#EEF4F0] text-[#0B201B] border border-[#E1EBE4] font-medium font-mono">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Anomaly & Risk Flags */}
          {candidate.flags.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">
                Peringatan Anomali & Manipulasi
              </h4>
              <div className="space-y-1.5">
                {candidate.flags.map((flag, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span className="font-mono font-medium">{flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-[#E1EBE4] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#6C837C]">
              Rekomendasi Keputusan AI: <strong className="text-[#0B201B]">{candidate.recommendation}</strong>
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  navigate(`/evidence-graph/${candidate.id}`);
                  onClose();
                }}
                className="px-4 py-2.5 bg-[#DAF1DE] hover:bg-[#C2E0C4] text-[#0B2B26] font-semibold text-xs rounded-xl border border-[#8EB69B]/40 transition-colors flex items-center justify-center gap-1.5"
                title="Buka Candidate Evidence Graph di React Flow"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#235347]" />
                <span>Evidence Graph</span>
              </button>
              <button
                onClick={() => {
                  alert(`[Simulasi Review HR]: Kandidat ${candidate.masked_identifier} dijadwalkan wawancara (Atomic Calendar Lock).`);
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#0B2B26] hover:bg-[#163832] text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-3.5 h-3.5 text-[#8EB69B]" />
                Approve & Schedule
              </button>
              <button
                onClick={() => {
                  alert(`[Simulasi Review HR]: Kandidat ${candidate.masked_identifier} ditolak.`);
                  onClose();
                }}
                className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition-colors"
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
