import { createContext, useContext, useState, useEffect } from 'react'

// ══════════════════════════════════════════════════════════
// GLOB ERP — Theme System
// Day/Night mode + 6 color themes with live accent switching
// ══════════════════════════════════════════════════════════

const THEMES = {
  cyan:   { name: 'Cyan Nebula',    icon: '💎', color: '#06b6d4' },
  blue:   { name: 'Blue Galaxy',    icon: '🌊', color: '#4f8fff' },
  purple: { name: 'Purple Haze',    icon: '🔮', color: '#a855f7' },
  orange: { name: 'Orange Forge',   icon: '🔥', color: '#ef4d23' },
  green:  { name: 'Green Circuit',  icon: '⚡', color: '#22c55e' },
  gold:   { name: 'Gold Precision', icon: '✨', color: '#f59e0b' },
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
    const accent = THEMES[themeKey]?.color || '#06b6d4'
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
      root.style.setProperty('--bg-primary', '#f5f6fa')
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-input', '#f0f1f5')
      root.style.setProperty('--border', 'rgba(0,0,0,0.08)')
      root.style.setProperty('--border-input', 'rgba(0,0,0,0.12)')
      root.style.setProperty('--text-primary', '#1a1a2e')
      root.style.setProperty('--text-muted', 'rgba(0,0,0,0.4)')
      root.style.setProperty('--text-secondary', 'rgba(0,0,0,0.6)')
      root.style.setProperty('--text-bright', '#000')
      root.style.setProperty('--navy', '#1a1a2e')
      root.classList.add('light-mode')
      root.classList.remove('dark-mode')
    } else {
      root.style.setProperty('--bg-primary', '#0a0a1a')
      root.style.setProperty('--bg-card', 'rgba(14,18,36,0.97)')
      root.style.setProperty('--bg-input', 'rgba(255,255,255,0.05)')
      root.style.setProperty('--border', 'rgba(255,255,255,0.08)')
      root.style.setProperty('--border-input', 'rgba(255,255,255,0.1)')
      root.style.setProperty('--text-primary', '#ffffff')
      root.style.setProperty('--text-muted', 'rgba(255,255,255,0.4)')
      root.style.setProperty('--text-secondary', 'rgba(255,255,255,0.6)')
      root.style.setProperty('--text-bright', '#fff')
      root.style.setProperty('--navy', '#0d1b2a')
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
