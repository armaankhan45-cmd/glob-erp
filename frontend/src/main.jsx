import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

const THEMES = {
  cyan:   { name: 'Cyan',        class: 'theme-cyan',   color: '#06b6d4', icon: '💎' },
  blue:   { name: 'Electric Blue',class: 'theme-blue',  color: '#3b82f6', icon: '⚡' },
  purple: { name: 'Neon Purple',  class: 'theme-purple', color: '#8b5cf6', icon: '🔮' },
  green:  { name: 'Emerald',      class: 'theme-green',  color: '#10b981', icon: '🌿' },
  gold:   { name: 'Gold',         class: 'theme-gold',   color: '#f59e0b', icon: '👑' },
  red:    { name: 'Cherry Red',   class: 'theme-red',    color: '#e11d48', icon: '🍒' },
  orange: { name: 'Orange',       class: 'theme-orange', color: '#ef4d23', icon: '🔥' },
  pink:   { name: 'Hot Pink',     class: 'theme-pink',   color: '#ec4899', icon: '🌺' },
  lime:   { name: 'Lime',         class: 'theme-lime',   color: '#84cc16', icon: '🍋' },
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    return localStorage.getItem('glob-theme') || 'cyan'
  })

  useEffect(() => {
    const theme = THEMES[themeKey]
    if (theme) {
      Object.values(THEMES).forEach(t => document.documentElement.classList.remove(t.class))
      document.documentElement.classList.add(theme.class)
      const root = document.documentElement
      root.style.setProperty('--accent', theme.color)
      root.style.setProperty('--accent-glow', theme.color.replace(')', ',0.3)').replace('rgb', 'rgba'))
      localStorage.setItem('glob-theme', themeKey)
    }
  }, [themeKey])

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, themes: THEMES, currentTheme: THEMES[themeKey] }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export { THEMES }

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)
