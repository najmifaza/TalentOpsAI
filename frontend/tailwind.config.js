/** @type {import('tailwindcss').Config} */
export default {
  darkMode: false,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Grafana Labs Core Palette
        grafana: {
          canvas: '#f4f4f6',
          surface: '#ffffff',
          divider: '#e6e6ea',
          steel: '#d8d8df',
          panel: '#2b2d32',
          ink: '#000000',
          graphite: '#454554',
          slate: '#67677e',
          signal: '#1b55f5',
          'signal-hover': '#1545c7',
          'blue-mist': '#eaf0ff',
          'peach-paper': '#f4e5d9',
          'lilac-wash': '#f9e8ff',
          'apricot-fill': '#fad8ac',
          'orchid-edge': '#eeaafd',
          'sky-edge': '#8ec0ff',
          'tangerine-edge': '#ffae70',
        },
        // Compatibility aliasing to Grafana Labs system
        pine: {
          950: '#1b1d22',
          900: '#2b2d32', // charcoal panel
          850: '#34373e',
          800: '#454554', // graphite copy
          700: '#67677e', // slate navigation
          600: '#1b55f5', // electric signal
          500: '#1b55f5', // primary CTA
        },
        sage: {
          500: '#1b55f5',
          400: '#1b55f5', // accent blue
          300: '#8ec0ff', // sky edge
          200: '#d8d8df', // steel
          100: '#eaf0ff', // blue mist
          50: '#f4f4f6',  // cloud canvas
        },
        canvas: {
          bg: '#f4f4f6',
          subtle: '#ffffff',
          card: '#ffffff',
          border: '#e6e6ea',
          muted: '#d8d8df',
        },
        ink: {
          primary: '#000000',
          secondary: '#454554',
          muted: '#67677e',
          subtle: '#8c8c9e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 8px 20px -4px rgba(0, 0, 0, 0.08), 0 2px 6px -2px rgba(0, 0, 0, 0.04)',
        'elevated': '0 20px 35px -8px rgba(0, 0, 0, 0.12)',
        'subtle': '0px 0px 0px 1px rgba(0, 0, 0, 0.05), 0px 1px 3px 0px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem', // 24px (cards standard in Grafana design)
        '4xl': '2rem',
        'card': '24px',
        'btn': '8px',
      }
    },
  },
  plugins: [],
}
