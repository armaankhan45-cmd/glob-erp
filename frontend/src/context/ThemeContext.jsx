import { createContext, useContext, useState, useEffect } from 'react'

// ══════════════════════════════════════════════════════════
// GLOB ERP — Premium Theme System
// Day/Night mode + 6 color themes + theme-colored background
// ══════════════════════════════════════════════════════════

const THEMES = {
  cyan:   { name: 'Cyan Nebula',    icon: '💎', color: '#22d3ee', bgTint: '#0c1a2e' },
  blue:   { name: 'Blue Galaxy',    icon: '🌊', color: '#6ea8fe', bgTint: '#0e1a3a' },
  purple: { name: 'Purple Haze',    icon: '🔮', color: '#c084fc', bgTint: '#1a0e2e' },
  orange: { name: 'Orange Forge',   icon: '🔥', color: '#fb923c', bgTint: '#1e140a' },
  green:  { name: 'Green Circuit',  icon: '⚡', color: '#4ade80', bgTint: '#0a1e14' },
  gold:   { name: 'Gold Precision', icon: '✨', color: '#fbbf24', bgTint: '#1e1a0a' },
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

  // Apply theme CSS variables — background follows accent color
  useEffect(() => {
    const theme = THEMES[themeKey]
    const accent = theme?.color || '#22d3ee'
    const bgTint = theme?.bgTint || '#0c1a2e'
    const r = parseInt(accent.slice(1,3), 16)
    const g = parseInt(accent.slice(3,5), 16)
    const b = parseInt(accent.slice(5,7), 16)
    const root = document.documentElement

    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-rgb', `${r},${g},${b}`)
    root.style.setProperty('--accent-dark', `${accent}cc`)
    root.style.setProperty('--accent-light', `${accent}44`)
    root.style.setProperty('--bg-tint', bgTint)

    if (mode === 'light') {
      // Light mode: tinted background follows theme accent
      const lightTintMap = {
        cyan: '#eef6fc', blue: '#eef2ff', purple: '#f3efff',
        orange: '#fff6ed', green: '#edfff3', gold: '#fef9e7'
      }
      const lightBg = lightTintMap[themeKey] || '#f0f2f5'

      root.style.setProperty('--bg-primary', lightBg)
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-sidebar', 'rgba(255,255,255,0.95)')
      root.style.setProperty('--bg-topbar', 'rgba(255,255,255,0.88)')
      root.style.setProperty('--bg-input', '#eef0f5')
      root.style.setProperty('--bg-glass', 'rgba(0,0,0,0.03)')
      root.style.setProperty('--bg-glass-md', 'rgba(0,0,0,0.05)')
      root.style.setProperty('--bg-glass-strong', 'rgba(0,0,0,0.07)')
      root.style.setProperty('--border', `rgba(${r},${g},${b},0.12)`)
      root.style.setProperty('--border-md', 'rgba(0,0,0,0.06)')
      root.style.setProperty('--border-strong', `rgba(${r},${g},${b},0.18)`)
      root.style.setProperty('--border-input', `rgba(${r},${g},${b},0.14)`)
      root.style.setProperty('--text-primary', '#1e293b')
      root.style.setProperty('--text-muted', 'rgba(30,41,59,0.45)')
      root.style.setProperty('--text-secondary', 'rgba(30,41,59,0.65)')
      root.style.setProperty('--text-bright', '#0f172a')
      root.style.setProperty('--text-light', '#475569')
      root.style.setProperty('--navy', '#1e293b')
      root.classList.add('light-mode')
      root.classList.remove('dark-mode')
    } else {
      // Dark mode: background tinted with accent color
      root.style.setProperty('--bg-primary', bgTint)
      root.style.setProperty('--bg-card', `rgba(${Math.min(r+6,255)},${Math.min(g+8,255)},${Math.min(b+14,255)},0.97)`)
      root.style.setProperty('--bg-sidebar', `rgba(${Math.min(r+4,255)},${Math.min(g+6,255)},${Math.min(b+12,255)},0.96)`)
      root.style.setProperty('--bg-topbar', `rgba(${Math.min(r+6,255)},${Math.min(g+8,255)},${Math.min(b+16,255)},0.75)`)
      root.style.setProperty('--bg-input', `rgba(${r},${g},${b},0.06)`)
      root.style.setProperty('--bg-glass', `rgba(${r},${g},${b},0.04)`)
      root.style.setProperty('--bg-glass-md', `rgba(${r},${g},${b},0.06)`)
      root.style.setProperty('--bg-glass-strong', `rgba(${r},${g},${b},0.10)`)
      root.style.setProperty('--border', `rgba(${r},${g},${b},0.12)`)
      root.style.setProperty('--border-md', `rgba(${r},${g},${b},0.08)`)
      root.style.setProperty('--border-strong', `rgba(${r},${g},${b},0.18)`)
      root.style.setProperty('--border-input', `rgba(${r},${g},${b},0.14)`)
      root.style.setProperty('--text-primary', '#e2e8f0')
      root.style.setProperty('--text-muted', `rgba(${r},${g},${b},0.35)`)
      root.style.setProperty('--text-secondary', `rgba(226,232,240,0.65)`)
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
