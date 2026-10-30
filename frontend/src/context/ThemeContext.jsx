import { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react'

// ══════════════════════════════════════════════════════════
// GLOB ERP — Theme System
// Background stays NEUTRAL (does NOT change with theme)
// Only accent color (buttons, links, highlights) changes
// ══════════════════════════════════════════════════════════

const THEMES = {
  cyan:   { name: 'Teal',   icon: '', color: '#1f8fa8' },
  blue:   { name: 'Blue',   icon: '', color: '#3b6fd4' },
  purple: { name: 'Violet', icon: '', color: '#6d5bd0' },
  orange: { name: 'Amber',  icon: '', color: '#b7681f' },
  green:  { name: 'Green',  icon: '', color: '#2f8f5b' },
  gold:   { name: 'Ochre',  icon: '', color: '#a37a14' },
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem('glob-theme-key') || 'cyan')
  const [mode, setMode] = useState(() => localStorage.getItem('glob-mode') === 'light' ? 'light' : 'dark')

  const toggleMode = () => setMode(previous => previous === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    localStorage.setItem('glob-mode', mode)
  }, [mode])

  useEffect(() => {
    const onStorage = event => {
      if (event.key === 'glob-mode') setMode(event.newValue === 'light' ? 'light' : 'dark')
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
      root.style.setProperty('--bg-primary', '#f3f4f6')
      root.style.setProperty('--bg-page', '#f3f4f6')
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-sidebar', '#fbfbfc')
      root.style.setProperty('--bg-topbar', '#fbfbfc')
      root.style.setProperty('--bg-input', '#ffffff')
      root.style.setProperty('--bg-glass', 'rgba(0,0,0,0.04)')
      root.style.setProperty('--bg-glass-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--bg-glass-strong', 'rgba(0,0,0,0.08)')
      root.style.setProperty('--surface-glass', 'rgba(0,0,0,0.04)')
      root.style.setProperty('--border', 'rgba(15,23,42,0.11)')
      root.style.setProperty('--border-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--border-strong', 'rgba(0,0,0,0.14)')
      root.style.setProperty('--border-input', 'rgba(0,0,0,0.12)')
      root.style.setProperty('--border-glass-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--glass-border', 'rgba(0,0,0,0.10)')
      root.style.setProperty('--text-primary', '#1a1a2e')
      root.style.setProperty('--text', '#1a1a2e')
      root.style.setProperty('--text-muted', '#7b8190')
      root.style.setProperty('--text-secondary', '#505667')
      root.style.setProperty('--text-bright', '#0f172a')
      root.style.setProperty('--text-light', '#475569')
      root.style.setProperty('--text-faint', 'rgba(26,26,46,0.30)')
      root.style.setProperty('--navy', '#1a1a2e')
      root.style.colorScheme = 'light'
      root.classList.add('light-mode')
      root.classList.remove('dark-mode')
    } else {
      root.style.setProperty('--bg-primary', '#131518')
      root.style.setProperty('--bg-page', '#0e1012')
      root.style.setProperty('--bg-card', '#1a1d21')
      root.style.setProperty('--bg-sidebar', '#16181b')
      root.style.setProperty('--bg-topbar', '#16181b')
      root.style.setProperty('--bg-input', 'rgba(255,255,255,0.06)')
      root.style.setProperty('--bg-glass', 'rgba(255,255,255,0.04)')
      root.style.setProperty('--bg-glass-md', 'rgba(255,255,255,0.06)')
      root.style.setProperty('--bg-glass-strong', 'rgba(255,255,255,0.10)')
      root.style.setProperty('--surface-glass', 'rgba(255,255,255,0.04)')
      root.style.setProperty('--border', 'rgba(255,255,255,0.08)')
      root.style.setProperty('--border-md', 'rgba(255,255,255,0.05)')
      root.style.setProperty('--border-strong', 'rgba(255,255,255,0.12)')
      root.style.setProperty('--border-input', 'rgba(255,255,255,0.10)')
      root.style.setProperty('--border-glass-md', 'rgba(255,255,255,0.05)')
      root.style.setProperty('--glass-border', 'rgba(255,255,255,0.08)')
      root.style.setProperty('--text-primary', '#e4e6ea')
      root.style.setProperty('--text', '#e4e6ea')
      root.style.setProperty('--text-muted', '#80868f')
      root.style.setProperty('--text-secondary', '#a3a9b2')
      root.style.setProperty('--text-bright', '#f4f5f7')
      root.style.setProperty('--text-light', '#cbd5d1')
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
