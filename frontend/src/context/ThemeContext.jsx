import { createContext, useContext, useState, useEffect } from 'react'

// ══════════════════════════════════════════════════════════
// GLOB ERP — Relaxing Theme System
// Day/Night mode + 6 color themes with live accent switching
// All CSS variables for both modes
// ══════════════════════════════════════════════════════════

const THEMES = {
  cyan:   { name: 'Cyan Nebula',    icon: '💎', color: '#22d3ee' },
  blue:   { name: 'Blue Galaxy',    icon: '🌊', color: '#6ea8fe' },
  purple: { name: 'Purple Haze',    icon: '🔮', color: '#c084fc' },
  orange: { name: 'Orange Forge',   icon: '🔥', color: '#fb923c' },
  green:  { name: 'Green Circuit',  icon: '⚡', color: '#4ade80' },
  gold:   { name: 'Gold Precision', icon: '✨', color: '#fbbf24' },
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem('glob-theme-key') || 'cyan')
  const [mode, setMode] = useState(() => localStorage.getItem('glob-mode') || 'dark')

  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    localStorage.setItem('glob-mode', next)
  }

  useEffect(() => {
    localStorage.setItem('glob-theme-key', themeKey)
  }, [themeKey])

  // Apply theme CSS variables to document root
  useEffect(() => {
    const accent = THEMES[themeKey]?.color || '#22d3ee'
    const r = parseInt(accent.slice(1,3), 16)
    const g = parseInt(accent.slice(3,5), 16)
    const b = parseInt(accent.slice(5,7), 16)
    const root = document.documentElement

    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-rgb', `${r},${g},${b}`)
    root.style.setProperty('--accent-dark', `${accent}cc`)
    root.style.setProperty('--accent-light', `${accent}44`)

    // Mode-specific variables
    if (mode === 'light') {
      root.style.setProperty('--bg-primary', '#f0f2f5')
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-sidebar', 'rgba(255,255,255,0.92)')
      root.style.setProperty('--bg-topbar', 'rgba(255,255,255,0.82)')
      root.style.setProperty('--bg-input', '#e8eaef')
      root.style.setProperty('--bg-glass', 'rgba(0,0,0,0.04)')
      root.style.setProperty('--bg-glass-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--bg-glass-strong', 'rgba(0,0,0,0.08)')
      root.style.setProperty('--border', 'rgba(0,0,0,0.09)')
      root.style.setProperty('--border-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--border-strong', 'rgba(0,0,0,0.12)')
      root.style.setProperty('--border-input', 'rgba(0,0,0,0.14)')
      root.style.setProperty('--text-primary', '#1e293b')
      root.style.setProperty('--text-muted', 'rgba(30,41,59,0.45)')
      root.style.setProperty('--text-secondary', 'rgba(30,41,59,0.65)')
      root.style.setProperty('--text-bright', '#0f172a')
      root.style.setProperty('--text-light', '#475569')
      root.style.setProperty('--navy', '#1e293b')
      root.classList.add('light-mode')
      root.classList.remove('dark-mode')
    } else {
      root.style.setProperty('--bg-primary', '#0f1419')
      root.style.setProperty('--bg-card', 'rgba(22,28,38,0.97)')
      root.style.setProperty('--bg-sidebar', 'rgba(14,20,30,0.96)')
      root.style.setProperty('--bg-topbar', 'rgba(18,24,34,0.75)')
      root.style.setProperty('--bg-input', 'rgba(255,255,255,0.06)')
      root.style.setProperty('--bg-glass', 'rgba(255,255,255,0.05)')
      root.style.setProperty('--bg-glass-md', 'rgba(255,255,255,0.07)')
      root.style.setProperty('--bg-glass-strong', 'rgba(255,255,255,0.10)')
      root.style.setProperty('--border', 'rgba(255,255,255,0.09)')
      root.style.setProperty('--border-md', 'rgba(255,255,255,0.06)')
      root.style.setProperty('--border-strong', 'rgba(255,255,255,0.12)')
      root.style.setProperty('--border-input', 'rgba(255,255,255,0.12)')
      root.style.setProperty('--text-primary', '#e2e8f0')
      root.style.setProperty('--text-muted', 'rgba(226,232,240,0.45)')
      root.style.setProperty('--text-secondary', 'rgba(226,232,240,0.65)')
      root.style.setProperty('--text-bright', '#f8fafc')
      root.style.setProperty('--text-light', '#cbd5e1')
      root.style.setProperty('--navy', '#1e293b')
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

export function useTheme() {
  return useContext(ThemeContext)
}

export { THEMES }
