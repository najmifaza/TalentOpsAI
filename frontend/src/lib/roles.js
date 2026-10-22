import { getUser } from './api';

// Satu-satunya sumber kebenaran untuk pembatasan aksi di UI. Daftar role di sini
// disalin dari `require_roles(...)` di backend/app/api/*.py — kalau backend berubah,
// ubah di sini juga. Tujuannya bukan keamanan (backend yang menegakkan), tapi supaya
// UI tidak menawarkan tombol yang pasti ditolak 403.
export const ROLE_LABELS = {
  admin: 'Admin Workspace',
  recruiter: 'Rekruter',
  hiring_manager: 'Hiring Manager',
  compliance_officer: 'Compliance Officer',
};

const ALLOWED = {
  upload: ['admin', 'recruiter'],
  batchTriage: ['admin', 'recruiter', 'hiring_manager'],
  review: ['admin', 'recruiter', 'hiring_manager'],
  unmask: ['admin', 'recruiter', 'hiring_manager', 'compliance_officer'],
  deleteCandidate: ['admin', 'compliance_officer', 'recruiter'],
};

export const currentRole = () => getUser()?.role || 'recruiter';

export const roleLabel = (role = currentRole()) => ROLE_LABELS[role] || role;

export function can(action, role = currentRole()) {
  const allowed = ALLOWED[action];
  if (!allowed) return true;
  return allowed.includes(role);
}

// Unmask has a second gate the role list above does not express: the backend
// refuses it while a candidate is still in blind review unless the caller is an
// admin or compliance officer (see unmask_candidate_pii). Offering the form to a
// recruiter in that state produces a button that can only ever 403.
const UNMASK_DURING_BLIND_REVIEW = ['admin', 'compliance_officer'];

/** null when unmask is allowed right now, otherwise the reason to show the user. */
export function unmaskBlockedReason(status, role = currentRole()) {
  if (!can('unmask', role)) {
    return `Role ${roleLabel(role)} tidak berwenang membuka identitas kandidat.`;
  }
  if (status !== 'approved' && !UNMASK_DURING_BLIND_REVIEW.includes(role)) {
    return 'Identitas terkunci selama blind review. Setujui kandidat lebih dulu, atau minta Admin / Compliance Officer yang membuka.';
  }
  return null;
}
