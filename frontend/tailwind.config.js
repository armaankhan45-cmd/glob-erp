/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { 50:'#fef3f0',100:'#fde3da',200:'#fbc7b4',300:'#f7a282',400:'#f2744d',500:'#ef4d23',600:'#d93d14',700:'#b42f10',800:'#902612',900:'#782214' },
        brand: {
          orange: '#ef4d23',
          deep: '#06080f',
          page: '#080b14',
          panel: '#0c1020',
          card: '#0e1224',
          dark: '#06080f',
          gray: '#1A1A1A',
        },
        nebula: { blue:'#4f8fff', purple:'#a855f7', cyan:'#06b6d4', orange:'#ef4d23' },
        dark: { 800:'#0c1020',900:'#06080f',950:'#030508' },
        neutral: { 50:'#fafafa',100:'#f5f5f5',200:'#e5e5e5',300:'#d4d4d4',400:'#a3a3a3',500:'#737373',600:'#525252',700:'#404040',800:'#262626',900:'#171717' }
      },
      fontFamily: {
        sans: ['"Inter"','ui-sans-serif','system-ui','sans-serif'],
        serif: ['"Instrument Serif"','serif'],
        mono: ['"Space Grotesk"','monospace'],
      },
    },
  },
  plugins: [],
}
