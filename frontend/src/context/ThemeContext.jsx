import { createContext, useContext, useState, useEffect } from 'react'

// ══════════════════════════════════════════════════════════
// GLOB ERP — Theme System
// Background stays NEUTRAL (does NOT change with theme)
// Only accent color (buttons, links, highlights) changes
// ══════════════════════════════════════════════════════════

const THEMES = {
  cyan:   { name: 'Cyan Nebula',   icon: '💎', color: '#22d3ee' },
  blue:   { name: 'Blue Galaxy',   icon: '🌊', color: '#6ea8fe' },
  purple: { name: 'Purple Haze',   icon: '🔮', color: '#c084fc' },
  orange: { name: 'Orange Forge',  icon: '🔥', color: '#fb923c' },
  green:  { name: 'Green Circuit', icon: '⚡', color: '#4ade80' },
  gold:   { name: 'Gold Precision',icon: '✨', color: '#fbbf24' },
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

  useEffect(() => { localStorage.setItem('glob-theme-key', themeKey) }, [themeKey])

  useEffect(() => {
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

    // ═══ ALL CSS vars used across the entire app ═══
    if (mode === 'light') {
      root.style.setProperty('--bg-primary', '#f5f7fa')
      root.style.setProperty('--bg-page', '#f5f7fa')
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-sidebar', 'rgba(255,255,255,0.95)')
      root.style.setProperty('--bg-topbar', 'rgba(255,255,255,0.90)')
      root.style.setProperty('--bg-input', '#ebeef3')
      root.style.setProperty('--bg-glass', 'rgba(0,0,0,0.04)')
      root.style.setProperty('--bg-glass-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--bg-glass-strong', 'rgba(0,0,0,0.08)')
      root.style.setProperty('--surface-glass', 'rgba(0,0,0,0.04)')
      root.style.setProperty('--border', 'rgba(0,0,0,0.10)')
      root.style.setProperty('--border-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--border-strong', 'rgba(0,0,0,0.14)')
      root.style.setProperty('--border-input', 'rgba(0,0,0,0.12)')
      root.style.setProperty('--border-glass-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--glass-border', 'rgba(0,0,0,0.10)')
      root.style.setProperty('--text-primary', '#1a1a2e')
      root.style.setProperty('--text', '#1a1a2e')
      root.style.setProperty('--text-muted', 'rgba(26,26,46,0.40)')
      root.style.setProperty('--text-secondary', 'rgba(26,26,46,0.60)')
      root.style.setProperty('--text-bright', '#0f172a')
      root.style.setProperty('--text-light', '#475569')
      root.style.setProperty('--text-faint', 'rgba(26,26,46,0.30)')
      root.style.setProperty('--navy', '#1a1a2e')
      root.classList.add('light-mode')
      root.classList.remove('dark-mode')
    } else {
      root.style.setProperty('--bg-primary', '#0f1419')
      root.style.setProperty('--bg-page', '#080b14')
      root.style.setProperty('--bg-card', 'rgba(22,28,38,0.97)')
      root.style.setProperty('--bg-sidebar', 'rgba(16,22,32,0.96)')
      root.style.setProperty('--bg-topbar', 'rgba(18,24,34,0.80)')
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
      root.style.setProperty('--text-primary', '#e2e8f0')
      root.style.setProperty('--text', '#e2e8f0')
      root.style.setProperty('--text-muted', 'rgba(226,232,240,0.40)')
      root.style.setProperty('--text-secondary', 'rgba(226,232,240,0.60)')
      root.style.setProperty('--text-bright', '#f8fafc')
      root.style.setProperty('--text-light', '#cbd5d1')
      root.style.setProperty('--text-faint', 'rgba(226,232,240,0.30)')
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

export function useTheme() { return useContext(ThemeContext) }
export { THEMES }
