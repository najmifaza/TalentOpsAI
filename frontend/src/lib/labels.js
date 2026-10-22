// Satu sumber label untuk seluruh UI. Enum backend tidak boleh tampil ke user.
const RECOMMENDATION_LABELS = {
  STRONG_MATCH: 'Sangat Sesuai',
  REVIEW_REQUIRED: 'Perlu Review HR',
  WEAK_FIT: 'Kurang Sesuai',
  SECURITY_QUARANTINE: 'Karantina Keamanan',
  PENDING_SCAN: 'Menunggu Scan',
};

const PRIORITY_LABELS = {
  STANDARD: 'Prioritas Standar',
  HIGH_ATTENTION: 'Perlu Perhatian Khusus',
};

// Anomali berasal dari parser ingestion dan scoring engine (scoring.py:422-511).
// Sebelumnya kode ini tercetak mentah di tabel kandidat.
const ANOMALY_LABELS = {
  PROMPT_INJECTION: 'Indikasi Prompt Injection',
  HIDDEN_TEXT: 'Teks Tersembunyi',
  CAREER_BREAK_FLAG: 'Jeda Karier > 12 Bulan',
  TITLE_INFLATION_DETECTED: 'Indikasi Inflasi Jabatan',
};

// Predikat karantina disalin dari backend (jobs.py:275-276, triage_service.py:121).
// CAREER_BREAK_FLAG sengaja tidak termasuk: severity-nya LOW dan scoring.py:516
// menyebutnya "bukan pelanggaran".
const SECURITY_FLAG_PREFIXES = ['PROMPT_INJECTION', 'HIDDEN_TEXT', 'SECURITY_QUARANTINE'];

export const isSecurityFlag = (flag) => {
  const f = String(flag || '');
  return SECURITY_FLAG_PREFIXES.some((prefix) => f.startsWith(prefix));
};

export const flagLabel = (flag) => {
  const f = String(flag || '');
  if (ANOMALY_LABELS[f]) return ANOMALY_LABELS[f];
  if (f.startsWith('CONCURRENT_FULLTIME_OVERLAP')) return 'Tumpang Tindih Kerja Penuh Waktu';
  if (f.startsWith('SECURITY_QUARANTINE')) return 'Karantina Keamanan';
  return f;
};

// Backend menulis satu baris per temuan, jadi anomali yang sama bisa datang dua
// kali dan tabel mencetak badge kembar.
export const dedupeFlags = (flags) => [...new Set((flags || []).filter(Boolean))];

// Berkas belum dievaluasi AI. Dulu kondisi ini disalin di DashboardOverview dan
// CandidateTable dengan urutan pemeriksaan berbeda.
export const isUnscanned = (candidate) => {
  const c = candidate || {};
  return (
    c.scan_status === 'UNSCANNED' ||
    c.overall_score === null ||
    c.overall_score === undefined ||
    c.recommendation === 'PENDING_SCAN' ||
    c.status === 'queued'
  );
};

// Satu kategori per kandidat, dipakai bersama oleh kartu KPI, badge tabel, dropdown
// filter, dan kartu per-lowongan. Sebelumnya ada tiga definisi yang tidak sepakat:
// kartu KPI menganggap flag apa pun sebagai karantina, tabel memakai
// recommendation, dan kartu lowongan hanya mengenal tiga kategori. Akibatnya satu
// kandidat muncul di kartu "Karantina Keamanan" padahal tabel menulis "Kurang
// Sesuai", dan kartu tidak pernah menjumlah ke total.
//
// Urutannya mengikuti matriks keputusan backend (scoring.py:549-561): karantina
// lebih dulu, lalu rekomendasi yang sudah dihitung backend.
export const categorize = (candidate) => {
  const c = candidate || {};
  if (isUnscanned(c)) return 'PENDING_SCAN';
  if (c.recommendation === 'SECURITY_QUARANTINE') return 'SECURITY_QUARANTINE';
  if ((c.flags || []).some(isSecurityFlag)) return 'SECURITY_QUARANTINE';
  if (c.recommendation === 'STRONG_MATCH') return 'STRONG_MATCH';
  if (c.recommendation === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  return 'WEAK_FIT';
};

// Unknown enums fall back to the raw value so a new backend state is visible
// instead of silently rendering an empty cell.
export const recLabel = (key) => RECOMMENDATION_LABELS[key] || key || '—';

export const priorityLabel = (key) => PRIORITY_LABELS[key] || key || '—';
