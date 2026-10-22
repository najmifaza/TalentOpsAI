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
