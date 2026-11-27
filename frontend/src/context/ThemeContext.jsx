import { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react'

// ══════════════════════════════════════════════════════════
// GLOB ERP — Theme System
// All colours live in styles.css (:root = light, .dark-mode = dark).
// This file only toggles the mode class and sets the accent colour.
// ══════════════════════════════════════════════════════════

const THEMES = {
  cyan:   { name: 'Saffron',  icon: '', color: '#d9480f' },
  blue:   { name: 'Indigo',   icon: '', color: '#4c5fd5' },
  green:  { name: 'Emerald',  icon: '', color: '#0c8a5f' },
  purple: { name: 'Plum',     icon: '', color: '#8b3fa8' },
  orange: { name: 'Teal',     icon: '', color: '#0f7c8a' },
  gold:   { name: 'Graphite', icon: '', color: '#3f4654' },
}

const safeGet = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const safeSet = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => (THEMES[safeGet('glob-theme-key')] ? safeGet('glob-theme-key') : 'cyan'))
  const [mode, setMode] = useState(() => safeGet('glob-mode-v3') === 'dark' ? 'dark' : 'light')
  const toggleMode = () => setMode(m => m === 'dark' ? 'light' : 'dark')

  useEffect(() => { safeSet('glob-mode-v3', mode) }, [mode])
  useEffect(() => { safeSet('glob-theme-key', themeKey) }, [themeKey])
  useEffect(() => {
    const onStorage = e => { if (e.key === 'glob-mode-v3') setMode(e.newValue === 'dark' ? 'dark' : 'light') }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useLayoutEffect(() => {
    const accent = THEMES[themeKey].color
    const [r, g, b] = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16))
    const mix = (c, t, k) => Math.round(c + (t - c) * k)
    const ink = mode === 'light' ? [r, g, b].map(c => mix(c, 0, .2)) : [r, g, b].map(c => mix(c, 255, .45))
    const root = document.documentElement
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-rgb', `${r},${g},${b}`)
    root.style.setProperty('--accent-dark', `${accent}cc`)
    root.style.setProperty('--accent-light', `${accent}44`)
    root.style.setProperty('--accent-ink', `rgb(${ink.join(',')})`)
    root.classList.toggle('dark-mode', mode === 'dark')
    root.classList.toggle('light-mode', mode === 'light')
  }, [themeKey, mode])

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, themes: THEMES, mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
export { THEMES }
