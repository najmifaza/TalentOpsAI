import React from 'react';
import { FlaskConical } from 'lucide-react';

// PRD Bab 6.2 (baris 388): the public demo environment is for synthetic data only and
// must say so on screen. Rendered in normal flow (not `fixed`) so it cannot collide
// with the offline banner, which already owns top-0.
// ponytail: shown by default and only hidden via VITE_DEMO_BANNER=false — the deploy
// this ships to IS the demo environment. Add a server-driven flag when a real tenant exists.
const isDemo = import.meta.env.VITE_DEMO_BANNER !== 'false';

export default function DemoDataBanner() {
  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-300 px-4 sm:px-8 py-2 flex items-start sm:items-center justify-center gap-2 text-[11px] sm:text-xs font-semibold text-amber-900 font-jkt"
    >
      <FlaskConical className="w-3.5 h-3.5 shrink-0 text-amber-700 mt-0.5 sm:mt-0" aria-hidden="true" />
      <span>
        Gunakan data sintetis untuk pengujian live demo. Lingkungan ini tidak menyimpan data pribadi asli.
      </span>
    </div>
  );
}
