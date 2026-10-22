// Self-check for the shared label/format helpers. No framework: run with
//   node frontend/scripts/check-labels.mjs
// Guards the regression this file exists for — the dossier printed
// "WAITING_APPROVAL" / "HIGH" / "LOW" raw because it bypassed labels.js, and
// the same score rendered as 88.7, 88,7 and 88,67 in three places.
import assert from 'node:assert/strict';
import {
  statusLabel,
  confidenceLabel,
  riskLabel,
  slotStatusLabel,
  formatScore,
  recLabel,
} from '../src/lib/labels.js';

// Every enum the backend can emit must have a human label.
assert.equal(statusLabel('waiting_approval'), 'Menunggu Keputusan HR');
assert.equal(statusLabel('queued'), 'Dalam Antrean');
assert.equal(confidenceLabel('HIGH'), 'Tinggi');
assert.equal(riskLabel('LOW'), 'Tidak Ada Indikasi');
assert.equal(slotStatusLabel('available'), 'Tersedia');
assert.equal(recLabel('STRONG_MATCH'), 'Sangat Sesuai');

// No label may echo the raw enum back. Each labeler is checked against the
// enums it actually owns — a fallback is correct for a foreign value (see the
// last assertion), so the domains must not be crossed here.
const DOMAINS = [
  [statusLabel, ['queued', 'analyzing', 'waiting_approval', 'approved', 'rejected', 'request_info', 'failed']],
  [confidenceLabel, ['HIGH', 'MEDIUM', 'LOW']],
  [riskLabel, ['HIGH', 'MEDIUM', 'LOW']],
  [slotStatusLabel, ['available', 'tentative', 'booked']],
];
for (const [fn, raws] of DOMAINS) {
  for (const raw of raws) {
    const out = fn(raw);
    assert.ok(!out.includes('_'), `${fn.name}(${raw}) leaked raw enum: ${out}`);
    assert.notEqual(out.toUpperCase(), raw.toUpperCase(), `${fn.name}(${raw}) is untranslated`);
  }
}

// One score format everywhere: two decimals, Indonesian comma.
assert.equal(formatScore(88.666666), '88,67');
assert.equal(formatScore(8), '8,00');
assert.equal(formatScore(70.8), '70,80');
assert.equal(formatScore(0), '0,00');
assert.equal(formatScore(null), '—');
assert.equal(formatScore(undefined), '—');
assert.equal(formatScore(NaN), '—');
// Never a dot decimal — that was the visible inconsistency.
assert.ok(!formatScore(88.67).includes('.'));

// Unknown enums stay visible instead of rendering blank, so a new backend
// state shows up as itself rather than an empty cell.
assert.equal(statusLabel('brand_new_state'), 'brand_new_state');
assert.equal(statusLabel(null), '—');

console.log('labels ok');
