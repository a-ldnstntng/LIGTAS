/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'surface-dim': '#111215',
        'surface': '#16171b',
        'surface-card': '#1c1e24',
        'surface-card-hover': '#23252e',
        'surface-border': '#262831',
        'surface-subtle': '#2c2e37',
        'surface-pill': '#282a33',
        'accent-orange': '#e07a3f',
        'accent-cyan': '#54b2d3',
        'accent-blue': '#878afb',
        obsidian: '#121214',
        graphite: '#1a1a1e',
        'pitch-black': '#000000',
        'clay-gold': '#FFE142',
        'clay-amber': '#f7b731',
        'card-slate': '#222328',
        'border-slate': '#26262b',
        'soft-red': '#ff6b6b',
        'sage-green': '#51cf66',
        'cyan-sensor': '#38bdf8',
        'cyan-blue': '#42C6FF',
        'electric-pink': '#FF64D4',
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
        card: '28px',
        subcard: '18px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ["'DM Sans'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ["'Manrope'", 'sans-serif'],
        serif: ["'Ledger'", 'Georgia', 'serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      }
    },
  },
  plugins: [],
}

