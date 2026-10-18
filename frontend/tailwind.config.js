/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pine: {
          950: '#051F20', // deep forest
          900: '#0B2B26', // forest emerald
          850: '#11322C',
          800: '#163832', // muted pine
          700: '#235347', // dark juniper
          600: '#2F6B5C',
          500: '#3D8271',
        },
        sage: {
          500: '#759F83',
          400: '#8EB69B', // soft sage accent
          300: '#A8CCA8',
          200: '#C2E0C4',
          100: '#DAF1DE', // soft mint cream
          50: '#F0F9F2',
        },
        canvas: {
          bg: '#EEF4F0',
          subtle: '#F6FAF7',
          card: '#FFFFFF',
          border: '#E1EBE4',
          muted: '#D0DFD5',
        },
        ink: {
          primary: '#0B201B',
          secondary: '#3D544E',
          muted: '#6C837C',
          subtle: '#9BB0A9',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'card': '0 2px 12px -2px rgba(11, 43, 38, 0.05), 0 1px 4px -1px rgba(11, 43, 38, 0.03)',
        'card-hover': '0 12px 24px -4px rgba(11, 43, 38, 0.08), 0 4px 8px -2px rgba(11, 43, 38, 0.04)',
        'elevated': '0 20px 35px -8px rgba(11, 43, 38, 0.12)',
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
