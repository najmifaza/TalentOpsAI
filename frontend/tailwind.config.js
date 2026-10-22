/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // WebEkspor Signature Palette
        'primary-black': '#233876',      // Deep Royal Navy / Headings & Dark Sections
        'primary-orange': '#F49523',     // Warm Tangerine Accent / Highlights & Primary CTA
        'primary-blue': '#01A0E4',       // Sky Cyan / Links & Secondary Badges
        'primary-border-100': '#E6E9EE', // Subtle Dividers
        'primary-border-200': '#E8E8EA', // Card & Panel Borders
        'primary-slate-50': '#F8FAFC',
        'primary-slate-100': '#F1F5F9',
        'primary-slate-300': '#CBD5E1',
        'primary-slate-200': '#E2E8F0',
        'primary-slate-400': '#94A3B8',
        'primary-slate-500': '#64748B',
        'primary-slate-600': '#475569',
        'primary-slate-700': '#334155',
        'primary-slate-800': '#1E293B',
        'primary-slate-900': '#0F172A',
        'primary-slate-1000': '#2B313B', // Dark Footer / Charcoal
        'primary-slate-1100': '#97989F', // Muted Metadata
        // Info blue used to be written as raw hex in the dossier, the upload modal
        // and the trace terminal; these tokens replace those literals.
        'primary-info': '#1B55F5',
        'primary-info-dark': '#1545C7',
        'primary-info-soft': '#EAF0FF',
        'primary-info-border': '#8EC0FF',
      },
      fontFamily: {
        jkt: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(35, 56, 118, 0.05), 0 1px 2px 0 rgba(35, 56, 118, 0.03)',
        'card-hover': '0 10px 25px -5px rgba(35, 56, 118, 0.08), 0 4px 10px -2px rgba(35, 56, 118, 0.04)',
        'orange-glow': '0 10px 25px -3px rgba(244, 149, 35, 0.25)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
