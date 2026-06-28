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
          gray: '#1A1A1A',
          orange: '#ef4d23',
          dark: '#0b0f1a',
          page: '#ededed',
          hero: '#d9d9d9',
          tray: '#f5f2ee',
        },
        dark: { 800:'#1e293b',900:'#0f172a',950:'#020617' },
        neutral: { 50:'#fafafa',100:'#f5f5f5',200:'#e5e5e5',300:'#d4d4d4',400:'#a3a3a3',500:'#737373',600:'#525252',700:'#404040',800:'#262626',900:'#171717' }
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
      },
    },
  },
  plugins: [],
}
