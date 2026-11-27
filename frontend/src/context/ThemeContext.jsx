import { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react'

// ══════════════════════════════════════════════════════════
// GLOB ERP — Theme System
// Background stays NEUTRAL (does NOT change with theme)
// Only accent color (buttons, links, highlights) changes
// ══════════════════════════════════════════════════════════

const THEMES = {
  cyan:   { name: 'Saffron',  icon: '', color: '#d9480f' },
  blue:   { name: 'Indigo',   icon: '', color: '#4c5fd5' },
  green:  { name: 'Emerald',  icon: '', color: '#0c8a5f' },
  purple: { name: 'Plum',     icon: '', color: '#8b3fa8' },
  orange: { name: 'Teal',     icon: '', color: '#0f7c8a' },
  gold:   { name: 'Graphite', icon: '', color: '#3f4654' },
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem('glob-theme-key') || 'cyan')
  const [mode, setMode] = useState(() => localStorage.getItem('glob-mode-v3') === 'dark' ? 'dark' : 'light')

  const toggleMode = () => setMode(previous => previous === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    localStorage.setItem('glob-mode-v3', mode)
  }, [mode])

  useEffect(() => {
    const onStorage = event => {
      if (event.key === 'glob-mode-v3') setMode(event.newValue === 'light' ? 'light' : 'dark')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => { localStorage.setItem('glob-theme-key', themeKey) }, [themeKey])

  useLayoutEffect(() => {
    const accent = THEMES[themeKey]?.color || '#22d3ee'
    const r = parseInt(accent.slice(1,3), 16)
    const g = parseInt(accent.slice(3,5), 16)
    const b = parseInt(accent.slice(5,7), 16)
    const root = document.documentElement

    // Accent vars — these change with theme
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-rgb', `${r},${g},${b}`)
    root.style.setProperty('--accent-dark', `${accent}cc`)
    root.style.setProperty('--accent-light', `${accent}44`)
    // readable accent for text/links: darker on light, lighter on dark
    const mix = (c, t, k) => Math.round(c + (t - c) * k)
    const ink = mode === 'light' ? [mix(r,0,.2), mix(g,0,.2), mix(b,0,.2)] : [mix(r,255,.45), mix(g,255,.45), mix(b,255,.45)]
    root.style.setProperty('--accent-ink', `rgb(${ink.join(',')})`)

    // ═══ ALL CSS vars used across the entire app ═══
    if (mode === 'light') {
      root.style.setProperty('--bg-primary', '#f6f4ef')
      root.style.setProperty('--bg-page', '#f6f4ef')
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-sidebar', '#1c1b19')
      root.style.setProperty('--bg-topbar', '#f6f4ef')
      root.style.setProperty('--bg-input', '#ffffff')
      root.style.setProperty('--bg-glass', 'rgba(0,0,0,0.04)')
      root.style.setProperty('--bg-glass-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--bg-glass-strong', 'rgba(0,0,0,0.08)')
      root.style.setProperty('--surface-glass', 'rgba(0,0,0,0.04)')
      root.style.setProperty('--border', '#e7e3da')
      root.style.setProperty('--border-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--border-strong', '#d6d0c3')
      root.style.setProperty('--border-input', '#dcd6ca')
      root.style.setProperty('--border-glass-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--glass-border', 'rgba(0,0,0,0.10)')
      root.style.setProperty('--text-primary', '#24221e')
      root.style.setProperty('--text', '#24221e')
      root.style.setProperty('--text-muted', '#8a857a')
      root.style.setProperty('--text-secondary', '#5b574f')
      root.style.setProperty('--text-bright', '#14130f')
      root.style.setProperty('--text-light', '#4a463f')
      root.style.setProperty('--text-faint', 'rgba(26,26,46,0.30)')
      root.style.setProperty('--navy', '#1c1b19')
      root.style.colorScheme = 'light'
      root.classList.add('light-mode')
      root.classList.remove('dark-mode')
    } else {
      root.style.setProperty('--bg-primary', '#141311')
      root.style.setProperty('--bg-page', '#141311')
      root.style.setProperty('--bg-card', '#1d1c19')
      root.style.setProperty('--bg-sidebar', '#0f0e0c')
      root.style.setProperty('--bg-topbar', '#141311')
      root.style.setProperty('--bg-input', '#232220')
      root.style.setProperty('--bg-glass', 'rgba(255,255,255,0.04)')
      root.style.setProperty('--bg-glass-md', 'rgba(255,255,255,0.06)')
      root.style.setProperty('--bg-glass-strong', 'rgba(255,255,255,0.10)')
      root.style.setProperty('--surface-glass', 'rgba(255,255,255,0.04)')
      root.style.setProperty('--border', '#2c2a26')
      root.style.setProperty('--border-md', 'rgba(255,255,255,0.05)')
      root.style.setProperty('--border-strong', '#3a3732')
      root.style.setProperty('--border-input', '#3a3732')
      root.style.setProperty('--border-glass-md', 'rgba(255,255,255,0.05)')
      root.style.setProperty('--glass-border', 'rgba(255,255,255,0.08)')
      root.style.setProperty('--text-primary', '#ece8df')
      root.style.setProperty('--text', '#ece8df')
      root.style.setProperty('--text-muted', '#8f897d')
      root.style.setProperty('--text-secondary', '#b3ada1')
      root.style.setProperty('--text-bright', '#faf8f3')
      root.style.setProperty('--text-light', '#cfc9bd')
      root.style.setProperty('--text-faint', 'rgba(226,232,240,0.30)')
      root.style.setProperty('--navy', '#1e293b')
      root.style.colorScheme = 'dark'
      root.classList.add('dark-mode')
      root.classList.remove('light-mode')
    }
  }, [themeKey, mode])

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, themes: THEMES, mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
export { THEMES }
