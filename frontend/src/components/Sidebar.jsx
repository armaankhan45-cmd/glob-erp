import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, THEMES } from '../context/ThemeContext'
import { LayoutDashboard, FileText, FileSpreadsheet, Users, ShoppingCart, Calculator, BarChart3, Settings, Download, RefreshCw, LogOut, Factory, Activity, Bot, Upload, Palette, Truck, Moon, Sun, ShieldCheck } from 'lucide-react'

// FIX: Role-based sidebar visibility — Deploy Control & Diagnostics are admin-only
const navItems = [
  { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, section: 'MAIN', role: 'any' },
  { label: 'AI Assistant', path: '/app/ai-assistant', icon: Bot, section: 'MAIN', role: 'admin' },
  { label: 'GST Invoices', path: '/app/invoices', icon: FileText, section: 'SALES', role: 'any' },
  { label: 'Quotations', path: '/app/quotations', icon: FileSpreadsheet, section: 'SALES', role: 'any' },
  { label: 'Customers', path: '/app/customers', icon: Users, section: 'SALES', role: 'any' },
  { label: 'Purchase Bills', path: '/app/purchases', icon: ShoppingCart, section: 'PURCHASE', role: 'any' },
  { label: 'Vehicle Papers', path: '/app/vehicle-papers', icon: Truck, section: 'VEHICLE', role: 'any' },
  { label: 'GST Reports', path: '/app/gst', icon: Calculator, section: 'FINANCE', role: 'any' },
  { label: 'Reports', path: '/app/reports', icon: BarChart3, section: 'FINANCE', role: 'any' },
  { label: 'Export Excel', path: '/app/export', icon: Download, section: 'SYSTEM', role: 'admin' },
  { label: 'Settings', path: '/app/settings', icon: Settings, section: 'SYSTEM', role: 'admin' },
  { label: 'Deploy Control', path: '/app/deploy', icon: Upload, section: 'SYSTEM', role: 'admin' },
  { label: 'Audit Log', path: '/app/audit', icon: ShieldCheck, section: 'SYSTEM', role: 'admin' },
  { label: 'Diagnostics', path: '/app/diagnostics', icon: Activity, section: 'SYSTEM', role: 'admin' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { logout, user } = useAuth()
  const { themeKey, setThemeKey, themes, mode, toggleMode } = useTheme()
  const navigate = useNavigate()
  const [showColors, setShowColors] = useState(false)
  const [navReady, setNavReady] = useState(false)
  const navRef = useRef(null)

  // ═══ Staggered nav entrance ═══
  useEffect(() => {
    const timer = setTimeout(() => setNavReady(true), 400)
    return () => clearTimeout(timer)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const sections = {}
  // FIX: Filter nav items by user role — non-admins don't see developer tools
  const visibleItems = navItems.filter(item => item.role === 'any' || user?.role === 'admin')
  visibleItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push(item)
  })

  const accentColor = themes[themeKey]?.color || '#06b6d4'

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16)
    const g = parseInt(hex.slice(3,5), 16)
    const b = parseInt(hex.slice(5,7), 16)
    return `${r},${g},${b}`
  }

  // Ripple effect on nav click
  const handleNavClick = (e) => {
    const link = e.currentTarget
    const rect = link.getBoundingClientRect()
    const ripple = document.createElement('span')
    const size = Math.max(rect.width, rect.height)
    ripple.style.cssText = `
      position:absolute; border-radius:50%; background:rgba(${hexToRgb(accentColor)},0.2);
      width:${size}px; height:${size}px; pointer-events:none;
      left:${e.clientX - rect.left - size/2}px; top:${e.clientY - rect.top - size/2}px;
      transform:scale(0); animation:ripple 0.6s ease-out forwards;
    `
    link.style.position = 'relative'
    link.style.overflow = 'hidden'
    link.appendChild(ripple)
    setTimeout(() => ripple.remove(), 600)
    onClose()
  }

  let navIndex = 0

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[280px] flex flex-col transition-transform duration-400 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'var(--bg-sidebar)', backdropFilter: 'blur(40px)', borderRight: `1px solid rgba(${hexToRgb(accentColor)}, 0.08)`, transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Brand */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: 'var(--accent)' }}>
            {user?.organization?.logo_url
              ? <img src={user.organization.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Factory size={18} style={{ color: '#fff' }} />}
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-[13px] leading-tight truncate" style={{ color: 'var(--text-bright)' }}>
              {user?.organization?.name ? user.organization.name.split(' ').slice(0, 2).join(' ') : 'Glob ERP'}
            </h1>
            <p className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>Fabrication manager</p>
          </div>
        </div>

        {/* Nav with staggered entrance */}
        <nav ref={navRef} className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <p className="text-[10px] uppercase tracking-[0.08em] px-3 mb-1 font-semibold" style={{ color: 'var(--text-muted)' }}>{section}</p>
              {items.map(item => {
                const delay = navReady ? `${navIndex * 0.05}s` : '0s'
                const animStyle = navReady ? { animation: `entranceLeft 0.4s cubic-bezier(0.16,1,0.3,1) ${delay} both` } : { opacity: 0 }
                navIndex++
                return (
                  <NavLink key={item.path} to={item.path} onClick={handleNavClick}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={animStyle}>
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: compact controls */}
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex gap-2">
            <button onClick={toggleMode} className="sb-mini flex-1" title="Switch light / dark">
              {mode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}<span>{mode === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
            <div className="relative flex-1">
              <button onClick={() => setShowColors(!showColors)} className="sb-mini w-full" title="Accent colour">
                <span className="w-3 h-3 rounded-full" style={{ background: accentColor }}></span><span>{themes[themeKey]?.name}</span>
              </button>
              {showColors && (
                <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg p-1 z-50" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
                  {Object.entries(themes).map(([key, t]) => (
                    <button key={key} onClick={() => { setThemeKey(key); setShowColors(false) }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px]"
                      style={{ color: themeKey === key ? 'var(--text-bright)' : 'var(--text-secondary)', background: themeKey === key ? 'var(--bg-glass-md)' : 'transparent' }}>
                      <span className="w-3 h-3 rounded-full" style={{ background: t.color }}></span>{t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-1 pt-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: 'var(--bg-glass-strong)', color: 'var(--text-bright)' }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-tight truncate" style={{ color: 'var(--text-bright)' }}>{user?.name || 'User'}</p>
              <p className="text-[11px] leading-tight truncate" style={{ color: 'var(--text-muted)' }}>{user?.role === 'admin' ? 'Admin' : user?.role || 'User'}</p>
            </div>
            <button onClick={() => window.location.reload()} className="sb-icon" title="Refresh"><RefreshCw size={14} /></button>
            <button onClick={handleLogout} className="sb-icon" title="Log out"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ripple { to { transform: scale(4); opacity: 0; } }
      `}</style>
    </>
  )
}
