// Tanggal tampil sebagai ISO mentah ("2026-10-20T14:30:00") di tiga tempat.
// Satu helper supaya formatnya konsisten.
const DATE_OPTS = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_OPTS = { hour: '2-digit', minute: '2-digit' };

const parse = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDateTime = (value) => {
  const d = parse(value);
  if (!d) return value ? String(value) : '-';
  return `${d.toLocaleDateString('id-ID', DATE_OPTS)} · ${d.toLocaleTimeString('id-ID', TIME_OPTS)}`;
};

export const formatDate = (value) => {
  const d = parse(value);
  if (!d) return value ? String(value) : '-';
  return d.toLocaleDateString('id-ID', DATE_OPTS);
};
