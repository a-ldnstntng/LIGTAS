/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        serif: ["'Ledger'", 'Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', "'SF Pro Display'", "'SF Compact Display'", 'sans-serif'],
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

