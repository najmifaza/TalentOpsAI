// Satu-satunya definisi 4 dimensi penilaian. Sebelumnya tiga file mendefinisikan
// ulang daftar ini dan dua di antaranya memakai label berbeda untuk data yang sama
// (dossier menyebut EDUCATION sebagai "Keyakinan Bukti").
export const DIMENSION_KEYS = ['SKILL', 'EXPERIENCE', 'EDUCATION', 'PORTFOLIO'];

export const DIMENSIONS = [
  { key: 'SKILL',      label: 'Kesesuaian Keahlian Inti',    short: 'Skill', bar: 'bg-primary-orange', text: 'text-primary-orange', dot: 'bg-primary-orange' },
  { key: 'EXPERIENCE', label: 'Kronologi Pengalaman Kerja',  short: 'Exp',   bar: 'bg-primary-blue',   text: 'text-primary-blue',   dot: 'bg-primary-blue' },
  { key: 'EDUCATION',  label: 'Linieritas Pendidikan',       short: 'Edu',   bar: 'bg-purple-500',     text: 'text-purple-700',     dot: 'bg-purple-500' },
  { key: 'PORTFOLIO',  label: 'Portofolio & Repositori',     short: 'Port',  bar: 'bg-emerald-500',    text: 'text-emerald-700',    dot: 'bg-emerald-500' },
];

export const DEFAULT_WEIGHT_PCT = { SKILL: 40, EXPERIENCE: 30, EDUCATION: 10, PORTFOLIO: 20 };

export const sumPct = (pct) => DIMENSION_KEYS.reduce((acc, k) => acc + (Number(pct?.[k]) || 0), 0);

// weight_config arrives as 0..1 ratios; the UI edits whole percents.
export const toPercent = (cfg) => {
  const src = cfg || {};
  const pct = {};
  DIMENSION_KEYS.forEach((k) => { pct[k] = Math.round((src[k] ?? DEFAULT_WEIGHT_PCT[k] / 100) * 100); });
  return pct;
};

// Backend requires ratios summing to 1.0. Input percents already sum to 100, so
// this is a scale plus a rounding-drift fix on the largest dimension.
export const toRatio = (pct) => {
  const total = sumPct(pct);
  if (total <= 0) {
    return { SKILL: 0.25, EXPERIENCE: 0.25, EDUCATION: 0.25, PORTFOLIO: 0.25 };
  }
  const out = {};
  DIMENSION_KEYS.forEach((k) => { out[k] = +( (Number(pct[k]) || 0) / total ).toFixed(4); });
  const drift = +(1 - DIMENSION_KEYS.reduce((a, k) => a + out[k], 0)).toFixed(4);
  if (drift !== 0) {
    const biggest = DIMENSION_KEYS.reduce((m, k) => (out[k] > out[m] ? k : m), DIMENSION_KEYS[0]);
    out[biggest] = +(out[biggest] + drift).toFixed(4);
  }
  return out;
};

// Moving one slider must keep the total at 100, otherwise the label and the saved
// value disagree. The remainder is spread over the other three proportionally.
export const redistribute = (pct, key, rawValue) => {
  const value = Math.max(0, Math.min(100, Math.round(Number(rawValue) || 0)));
  const next = { ...pct, [key]: value };
  const others = DIMENSION_KEYS.filter((k) => k !== key);
  const remaining = 100 - value;
  const othersSum = others.reduce((a, k) => a + (Number(next[k]) || 0), 0);

  if (othersSum <= 0) {
    const each = Math.floor(remaining / others.length);
    others.forEach((k) => { next[k] = each; });
  } else {
    others.forEach((k) => { next[k] = Math.round(((Number(next[k]) || 0) * remaining) / othersSum); });
  }

  let drift = 100 - sumPct(next);
  if (drift !== 0) {
    const target = others.reduce((m, k) => (next[k] > next[m] ? k : m), others[0]);
    next[target] = Math.max(0, Math.min(100, next[target] + drift));
    drift = 100 - sumPct(next);
    if (drift !== 0) next[key] = Math.max(0, Math.min(100, next[key] + drift));
  }
  return next;
};
