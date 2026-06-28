/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { 50:'#fef3f0',100:'#fde3da',200:'#fbc7b4',300:'#f7a282',400:'#f2744d',500:'#ef4d23',600:'#d93d14',700:'#b42f10',800:'#902612',900:'#782214' },
        brand: {
          orange: '#ef4d23',
          // Nebula theme
          deep: '#06080f',
          page: '#080b14',
          panel: '#0c1020',
          card: '#0e1224',
          glass: 'rgba(14,18,36,0.7)',
          // Legacy compat
          dark: '#06080f',
          gray: '#1A1A1A',
          hero: '#0c1020',
          tray: '#0a0d18',
        },
        nebula: {
          blue: '#4f8fff',
          purple: '#a855f7',
          cyan: '#22d3ee',
          orange: '#ef4d23',
        },
        dark: { 800:'#0c1020',900:'#06080f',950:'#030508' },
        neutral: { 50:'#fafafa',100:'#f5f5f5',200:'#e5e5e5',300:'#d4d4d4',400:'#a3a3a3',500:'#737373',600:'#525252',700:'#404040',800:'#262626',900:'#171717' }
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
        mono: ['"Space Grotesk"', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'orb1': 'orbMove1 20s ease-in-out infinite',
        'orb2': 'orbMove2 25s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(239,77,35,0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(239,77,35,0.4), 0 0 60px rgba(239,77,35,0.15)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        orbMove1: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '25%': { transform: 'translate(100px,-50px) scale(1.1)' },
          '50%': { transform: 'translate(200px,20px) scale(0.9)' },
          '75%': { transform: 'translate(50px,80px) scale(1.05)' },
          '100%': { transform: 'translate(0,0) scale(1)' },
        },
        orbMove2: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '25%': { transform: 'translate(-80px,60px) scale(0.95)' },
          '50%': { transform: 'translate(-160px,-30px) scale(1.1)' },
          '75%': { transform: 'translate(-40px,-80px) scale(0.9)' },
          '100%': { transform: 'translate(0,0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
