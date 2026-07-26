import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../main'
import { Bell, ChevronDown, Search, X, Sun, Moon } from 'lucide-react'

export default function TopBar() {
  const { user } = useAuth()
  const { mode, toggleMode } = useTheme()
  const [searchFocus, setSearchFocus] = useState(false)
  const [searchVal, setSearchVal] = useState('')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const emoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙'

  return (
    <header className="h-14 flex items-center justify-between px-5"
      style={{ background: 'rgba(12,16,32,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white">
            {emoji} {greeting}, <span className="glow-text">{user?.name?.split(' ')[0] || 'Admin'}</span>
          </h2>
          <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {user?.organization?.name || 'Glob ERP'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Search with glow effect */}
        <div className="hidden md:flex items-center gap-2 rounded-xl px-3 h-9 transition-all duration-300"
          style={{
            background: searchFocus ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${searchFocus ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(255,255,255,0.08)'}`,
            boxShadow: searchFocus ? '0 0 20px rgba(var(--accent-rgb),0.1)' : 'none',
            width: searchFocus ? '260px' : '200px'
          }}>
          <Search size={14} style={{ color: searchFocus ? 'var(--accent)' : 'var(--text-muted)', transition: 'color 0.2s ease' }} />
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            placeholder="Search invoices, customers..."
            className="bg-transparent border-none outline-none text-xs font-medium flex-1"
            style={{ color: 'var(--text-bright)' }}
          />
          {searchVal && (
            <button onClick={() => setSearchVal('')} className="transition-all duration-200 hover:scale-110">
              <X size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>

        {/* ☀️ Day / 🌙 Night Toggle */}
        <button
          onClick={toggleMode}
          className="w-9 h-9 rounded-xl flex items-center justify-center relative transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: mode === 'light'
              ? 'rgba(245,158,11,0.12)'
              : 'rgba(var(--accent-rgb),0.08)',
            border: mode === 'light'
              ? '1px solid rgba(245,158,11,0.25)'
              : '1px solid rgba(255,255,255,0.10)',
            color: mode === 'light' ? '#f59e0b' : 'rgba(255,255,255,0.6)'
          }}
          title={mode === 'dark' ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙'}
        >
          {mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          {/* Glow ring in light mode */}
          {mode === 'light' && (
            <div style={{
              position: 'absolute', inset: -2, borderRadius: '14px',
              border: '2px solid rgba(245,158,11,0.15)',
              animation: 'pulseGlow 3s ease-in-out infinite'
            }}></div>
          )}
        </button>

        {/* Notification */}
        <button className="w-9 h-9 rounded-xl flex items-center justify-center relative transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <Bell size={15} style={{ color: '#c8cad0' }} />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--accent)', animation: 'pulseGlow 2s ease-in-out infinite' }}></div>
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all duration-200 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', boxShadow: '0 0 12px rgba(var(--accent-rgb), 0.2)', padding: 0, minWidth: 32, height: 32 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{user?.name || 'User'}</p>
            <p className="text-[10px] leading-tight font-medium" style={{ color: 'var(--text-muted)' }}>{user?.email || ''}</p>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </header>
  )
}
