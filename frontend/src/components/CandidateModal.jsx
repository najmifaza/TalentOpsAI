import React, { useState } from 'react';
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
  GitBranch,
  Clock,
  UserCheck,
  Lock,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

const AVAILABLE_SLOTS = [
  {
    id: 101,
    date: 'Senin, 20 Oktober 2026',
    time: '09:30 - 10:30 WIB',
    interviewer: 'Najmi Faza (Lead Backend & Security Eng)',
    type: 'Technical System Architecture Interview',
    status: 'available',
  },
  {
    id: 102,
    date: 'Senin, 20 Oktober 2026',
    time: '14:00 - 15:00 WIB',
    interviewer: 'Najmi Faza (Lead Backend & Security Eng)',
    type: 'Code Review & Concurrency Deep Dive',
    status: 'available',
  },
  {
    id: 103,
    date: 'Selasa, 21 Oktober 2026',
    time: '10:00 - 11:00 WIB',
    interviewer: 'Hiring Committee Lead',
    type: 'Culture Fit & Problem Solving',
    status: 'available',
  },
];

export default function CandidateModal({ candidate, onClose }) {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState('dossier'); // 'dossier' | 'schedule' | 'scheduled_done' | 'reject_confirm' | 'reject_done'
  const [selectedSlotId, setSelectedSlotId] = useState(101);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedEvent, setBookedEvent] = useState(null);
  const [rejectReason, setRejectReason] = useState('Skor keahlian di bawah threshold kompetensi posisi');

  if (!candidate) return null;

  const selectedSlot = AVAILABLE_SLOTS.find(s => s.id === selectedSlotId) || AVAILABLE_SLOTS[0];

  // Helper untuk generate Event ID deterministik sesuai PRD Bab 8.2 & calendar.py
  const generateMockEventId = (slotId, candId) => {
    return `talentops_slot${slotId}_cand${candId}_${btoa(`ev_${slotId}`).replace(/=/g, '').toLowerCase()}`;
  };

  const handleConfirmSchedule = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const eventId = generateMockEventId(selectedSlot.id, candidate.id);
      setBookedEvent({
        eventId,
        slot: selectedSlot,
        timestamp: new Date().toLocaleString('id-ID'),
      });
      setViewState('scheduled_done');
    }, 600);
  };

  const handleConfirmReject = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setViewState('reject_done');
    }, 400);
  };

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

        {/* VIEW 1: DOSSIER OVERVIEW */}
        {viewState === 'dossier' && (
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

            {/* Actions Bar */}
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
                  onClick={() => setViewState('schedule')}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#0B2B26] hover:bg-[#163832] text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#8EB69B]" />
                  Approve & Schedule
                </button>
                <button
                  onClick={() => setViewState('reject_confirm')}
                  className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: INTERACTIVE CALENDAR SCHEDULING (Sprint 3) */}
        {viewState === 'schedule' && (
          <div className="mt-5 space-y-5 animate-fade-in">
            <div className="p-4 rounded-2xl bg-[#DAF1DE]/60 border border-[#C2E0C4] flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#0B2B26] shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-[#0B2B26]">
                  Atomic Calendar Lock Protocol (`SELECT ... FOR UPDATE`):
                </span>
                <p className="text-[#3D544E] mt-0.5 leading-relaxed">
                  Menjamin zero double-booking secara ACID pada database MariaDB. Slot yang Anda pilih akan dikunci eksklusif untuk kandidat <strong>{candidate.masked_identifier}</strong>.
                </p>
                <span className="inline-block mt-1 font-mono text-[10px] text-[#235347] font-bold bg-white px-2 py-0.5 rounded border border-[#C2E0C4]">
                  Mock Calendar Adapter [MOCK / SANDBOX] &bull; RFC 5545 Compatible
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#0B201B] uppercase tracking-wider mb-2.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#235347]" />
                <span>Pilih Slot Wawancara Yang Tersedia</span>
              </h4>

              <div className="space-y-2.5">
                {AVAILABLE_SLOTS.map((slot) => {
                  const isSelected = slot.id === selectedSlotId;
                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#F6FAF7] border-[#0B2B26] shadow-sm'
                          : 'bg-white border-[#E1EBE4] hover:border-[#8EB69B]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0B201B]">{slot.date}</span>
                          <span className="font-mono text-xs text-[#235347] font-bold bg-[#DAF1DE] px-2 py-0.5 rounded-md">
                            {slot.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#3D544E]">
                          Pewawancara: <strong>{slot.interviewer}</strong>
                        </p>
                        <p className="text-[10px] text-[#6C837C] font-mono">
                          Agenda: {slot.type}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                          AVAILABLE
                        </span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-[#0B2B26] bg-[#0B2B26]' : 'border-gray-300'
                        }`}>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white"></span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deterministic Event ID Preview */}
            <div className="p-3 bg-[#EEF4F0] rounded-xl border border-[#E1EBE4] text-xs space-y-1">
              <span className="text-[10px] text-[#6C837C] font-mono uppercase font-bold block">
                Deterministic Calendar Event ID Preview:
              </span>
              <code className="text-[#0B2B26] font-mono text-[11px] block truncate font-semibold">
                {generateMockEventId(selectedSlot.id, candidate.id)}
              </code>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[#E1EBE4] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setViewState('dossier')}
                className="px-4 py-2.5 rounded-xl bg-[#EEF4F0] hover:bg-[#E1EBE4] text-[#0B201B] text-xs font-semibold transition-colors"
              >
                Kembali ke Dossier
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSchedule}
                className="px-6 py-2.5 bg-[#0B2B26] hover:bg-[#163832] text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Mengunci Slot Transaksional...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#8EB69B]" />
                    <span>Konfirmasi Kunci Jadwal (Atomic Lock)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: SCHEDULED SUCCESS RECEIPT */}
        {viewState === 'scheduled_done' && bookedEvent && (
          <div className="mt-5 space-y-5 animate-fade-in text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-[#DAF1DE] text-[#0B2B26] mx-auto flex items-center justify-center border border-[#C2E0C4]">
              <CheckCircle2 className="w-8 h-8 text-[#235347]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0B201B]">
                Wawancara Berhasil Dijadwalkan!
              </h3>
              <p className="text-xs text-[#6C837C] max-w-md mx-auto">
                Slot kalender telah dikunci secara atomik pada database dan status kandidat diperbarui menjadi <strong className="text-[#0B2B26]">Approved & Scheduled</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F6FAF7] border border-[#E1EBE4] max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E1EBE4]">
                <span className="text-[#6C837C]">Kandidat:</span>
                <span className="font-mono font-bold text-[#0B2B26]">{candidate.masked_identifier}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E1EBE4]">
                <span className="text-[#6C837C]">Waktu:</span>
                <span className="font-semibold text-[#0B201B]">{bookedEvent.slot.date} &bull; {bookedEvent.slot.time}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E1EBE4]">
                <span className="text-[#6C837C]">Pewawancara:</span>
                <span className="font-semibold text-[#0B201B]">{bookedEvent.slot.interviewer}</span>
              </div>
              <div className="py-1">
                <span className="text-[#6C837C] block mb-0.5">Event ID Transaksional:</span>
                <code className="text-[#235347] font-mono text-[10px] break-all bg-white p-1 rounded border border-[#E1EBE4] block">
                  {bookedEvent.eventId}
                </code>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-[#0B2B26] hover:bg-[#163832] text-white text-xs font-semibold rounded-xl shadow-md transition-all"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: REJECT CONFIRMATION */}
        {viewState === 'reject_confirm' && (
          <div className="mt-5 space-y-5 animate-fade-in">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Konfirmasi Penolakan Berkas Pelamar:</span>
                <p className="mt-0.5 leading-relaxed text-rose-800">
                  Kandidat <strong>{candidate.masked_identifier}</strong> akan dipindahkan ke arsip ditolak. 
                  Kandidat dapat menggunakan hak penghapusan data mandiri (*Right to Erasure*) melalui token pelacakan mereka.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#0B201B] block mb-1.5 uppercase tracking-wider">
                Alasan Penolakan Evaluasi:
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#F6FAF7] border border-[#E1EBE4] rounded-xl text-xs text-[#0B201B] p-3 focus:outline-none focus:border-rose-500 font-medium"
              >
                <option value="Skor keahlian di bawah threshold kompetensi posisi">
                  Skor keahlian di bawah threshold kompetensi posisi (&lt; 60.0)
                </option>
                <option value="Terdeteksi anomali teks tersembunyi / manipulasi format">
                  Terdeteksi anomali teks tersembunyi / manipulasi format (Security Quarantine)
                </option>
                <option value="Overlapping timeline karier tidak terverifikasi">
                  Overlapping timeline karier tidak terverifikasi (&gt; 3 bulan)
                </option>
                <option value="Ketidakcocokan domain lowongan (Misal non-programmer melamar backend)">
                  Ketidakcocokan domain lowongan (Misal non-programmer melamar backend)
                </option>
              </select>
            </div>

            <div className="pt-4 border-t border-[#E1EBE4] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setViewState('dossier')}
                className="px-4 py-2.5 rounded-xl bg-[#EEF4F0] hover:bg-[#E1EBE4] text-[#0B201B] text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmReject}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses Penolakan...' : 'Konfirmasi Penolakan Berkas'}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 5: REJECTED SUCCESS */}
        {viewState === 'reject_done' && (
          <div className="mt-5 space-y-4 animate-fade-in text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center border border-rose-200">
              <XCircle className="w-8 h-8 text-rose-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#0B201B]">
                Kandidat Telah Ditolak
              </h3>
              <p className="text-xs text-[#6C837C] max-w-sm mx-auto">
                Status kandidat {candidate.masked_identifier} telah ditandai ditolak. Alasan dicatat dalam audit trail sistem.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-[#0B2B26] hover:bg-[#163832] text-white text-xs font-semibold rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
