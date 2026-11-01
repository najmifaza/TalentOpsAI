// Satu sumber label untuk seluruh UI. Enum backend tidak boleh tampil ke user.
const RECOMMENDATION_LABELS = {
  STRONG_MATCH: 'Sangat Sesuai',
  REVIEW_REQUIRED: 'Perlu Keputusan HR',
  WEAK_FIT: 'Kurang Sesuai',
  SECURITY_QUARANTINE: 'Ditahan (Perlu Verifikasi)',
  PENDING_SCAN: 'Menunggu Penilaian AI',
};

const PRIORITY_LABELS = {
  STANDARD: 'Prioritas Standar',
  HIGH_ATTENTION: 'Perlu Perhatian Khusus',
};

// Anomali berasal dari parser ingestion dan scoring engine (scoring.py:422-511).
// Sebelumnya kode ini tercetak mentah di tabel kandidat.
const ANOMALY_LABELS = {
  PROMPT_INJECTION: 'Manipulasi Teks CV',
  HIDDEN_TEXT: 'Teks Tersembunyi',
  CAREER_BREAK_FLAG: 'Jeda Riwayat Kerja > 12 Bulan',
  TITLE_INFLATION_DETECTED: 'Kenaikan Jabatan Tidak Wajar',
};

export const COSMETIC_ANOMALIES = new Set([
  'PDF_MICRO_IMAGE',
  'PDF_TINY_FONT',
  'PDF_OFFPAGE_TEXT',
  'PDF_IMAGE_ONLY_PAGE',
]);

export const isCosmeticAnomaly = (type) => {
  const t = String(type || '').toUpperCase();
  return COSMETIC_ANOMALIES.has(t);
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
  if (f.startsWith('CONCURRENT_FULLTIME_OVERLAP')) return 'Riwayat Dua Pekerjaan Bersamaan';
  if (f.startsWith('SECURITY_QUARANTINE')) return 'Ditahan (Perlu Verifikasi)';
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

// Status siklus berkas. ENUM di migrations/001_initial_schema.sql:67.
// Dulu dossier mencetak nilai mentahnya ("WAITING_APPROVAL") karena melewati
// labels.js; setiap enum yang tampil di JSX harus lewat sini.
const STATUS_LABELS = {
  queued: 'Dalam Antrean',
  analyzing: 'Sedang Dianalisis',
  waiting_approval: 'Menunggu Keputusan',
  approved: 'Disetujui',
  rejected: 'Tidak Dilanjutkan',
  request_info: 'Butuh Klarifikasi',
  failed: 'Gagal Diproses',
};

// Tingkat keyakinan bukti. Bukan skor — jangan dicampur ke grid 4 dimensi.
const CONFIDENCE_LABELS = {
  HIGH: 'Tinggi',
  MEDIUM: 'Sedang',
  LOW: 'Rendah',
};

// Risiko yang belum terurai. HIGH wajib ditandai, bukan sekadar angka.
const RISK_LABELS = {
  HIGH: 'Perlu Ditelusuri',
  MEDIUM: 'Sebagian Belum Jelas',
  LOW: 'Tidak Ada Indikasi',
};

const SLOT_STATUS_LABELS = {
  available: 'Tersedia',
  tentative: 'Sementara',
  booked: 'Terisi',
};

export const statusLabel = (key) => STATUS_LABELS[key] || key || '—';
export const confidenceLabel = (key) => CONFIDENCE_LABELS[key] || key || '—';
export const riskLabel = (key) => RISK_LABELS[key] || key || '—';
export const slotStatusLabel = (key) => SLOT_STATUS_LABELS[key] || key || '—';

// Skor selalu dua desimal dengan koma (id-ID). Sebelumnya dossier mencetak
// "88.7" sementara halaman lacak mencetak "88,67" untuk angka yang sama.
export const formatScore = (value) => {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(2).replace('.', ',');
};
