import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, THEMES } from '../context/ThemeContext'
import { LayoutDashboard, FileText, FileSpreadsheet, Users, ShoppingCart, Calculator, BarChart3, Settings, Download, RefreshCw, LogOut, Factory, Activity, Bot, Upload, Palette } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, section: 'MAIN' },
  { label: 'AI Assistant', path: '/app/ai-assistant', icon: Bot, section: 'MAIN' },
  { label: 'GST Invoices', path: '/app/invoices', icon: FileText, section: 'SALES' },
  { label: 'Quotations', path: '/app/quotations', icon: FileSpreadsheet, section: 'SALES' },
  { label: 'Customers', path: '/app/customers', icon: Users, section: 'SALES' },
  { label: 'Purchase Bills', path: '/app/purchases', icon: ShoppingCart, section: 'PURCHASE' },
  { label: 'GST Reports', path: '/app/gst', icon: Calculator, section: 'FINANCE' },
  { label: 'Reports', path: '/app/reports', icon: BarChart3, section: 'FINANCE' },
  { label: 'Export Excel', path: '/app/export', icon: Download, section: 'SYSTEM' },
  { label: 'Settings', path: '/app/settings', icon: Settings, section: 'SYSTEM' },
  { label: 'Deploy Control', path: '/app/deploy', icon: Upload, section: 'SYSTEM' },
  { label: 'Diagnostics', path: '/app/diagnostics', icon: Activity, section: 'SYSTEM' },
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
  navItems.forEach(item => {
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
        style={{ background: 'rgba(4,6,16,0.96)', backdropFilter: 'blur(40px)', borderRight: `1px solid rgba(${hexToRgb(accentColor)}, 0.08)`, transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Logo with spinning glow */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: `1px solid rgba(${hexToRgb(accentColor)}, 0.08)` }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 relative"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 0 24px rgba(${hexToRgb(accentColor)}, 0.25)` }}>
            {user?.organization?.logo_url
              ? <img src={user.organization.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
              : <Factory size={20} className="text-white" />
            }
            <div style={{ position:'absolute', inset:-3, borderRadius:'15px', background:`conic-gradient(transparent 40%, rgba(${hexToRgb(accentColor)},0.5) 50%, transparent 60%)`, animation:'spin 4s linear infinite', zIndex:-1 }}></div>
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white">
              {user?.organization?.name ? user.organization.name.split(' ').slice(0, 2).join(' ') : 'Glob ERP'}
            </h1>
            <p className="text-[10px] font-semibold" style={{ color: accentColor }}>Fabrication Manager</p>
          </div>
        </div>

        {/* Nav with staggered entrance */}
        <nav ref={navRef} className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <p className="text-[9px] uppercase tracking-[2.5px] px-3 mb-1 font-bold" style={{ color: accentColor, opacity: 0.5 }}>{section}</p>
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

        {/* Bottom section */}
        <div className="p-3 space-y-2" style={{ borderTop: `1px solid rgba(${hexToRgb(accentColor)}, 0.08)` }}>
          {/* Day/Night Toggle */}
          <button onClick={toggleMode}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 btn-shine"
            style={{
              background: mode === 'light' ? 'rgba(245,158,11,0.1)' : `rgba(${hexToRgb(accentColor)}, 0.08)`,
              border: mode === 'light' ? '1px solid rgba(245,158,11,0.2)' : `1px solid rgba(${hexToRgb(accentColor)}, 0.15)`,
              color: mode === 'light' ? '#f59e0b' : '#fff'
            }}>
            <span style={{ fontSize: 16 }}>{mode === 'dark' ? '🌙' : '☀️'}</span>
            <span>{mode === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          {/* Color Switcher */}
          <div className="relative">
            <button onClick={() => setShowColors(!showColors)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 btn-shine"
              style={{ background: `rgba(${hexToRgb(accentColor)}, 0.08)`, border: `1px solid rgba(${hexToRgb(accentColor)}, 0.15)`, color: 'var(--text-bright)' }}>
              <Palette size={16} style={{ color: accentColor }} />
              <span>Theme: {themes[themeKey]?.name}</span>
              <div className="w-4 h-4 rounded-full ml-auto" style={{ background: accentColor, boxShadow: `0 0 8px rgba(${hexToRgb(accentColor)}, 0.5)` }}></div>
            </button>
            {showColors && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl p-2 space-y-1 z-50"
                style={{ background: 'rgba(4,6,16,0.98)', border: `1px solid rgba(${hexToRgb(accentColor)}, 0.15)`, backdropFilter: 'blur(20px)', boxShadow: `0 0 30px rgba(${hexToRgb(accentColor)}, 0.08)`, animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                {Object.entries(themes).map(([key, t]) => (
                  <button key={key} onClick={() => { setThemeKey(key); setShowColors(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                    style={themeKey === key
                      ? { background: `rgba(${hexToRgb(t.color)}, 0.12)`, color: t.color, border: `1px solid rgba(${hexToRgb(t.color)}, 0.25)`, fontWeight: 700 }
                      : { color: '#c8cad0', border: '1px solid transparent' }
                    }>
                    <span className="text-base">{t.icon}</span>
                    <span>{t.name}</span>
                    {themeKey === key && <span className="ml-auto font-bold">✓</span>}
                    <div className="w-4 h-4 rounded-full ml-auto" style={{ background: t.color, boxShadow: themeKey === key ? `0 0 8px rgba(${hexToRgb(t.color)}, 0.5)` : 'none' }}></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Card */}
          <div className="p-3 rounded-xl" style={{ background: `rgba(${hexToRgb(accentColor)}, 0.04)`, border: `1px solid rgba(${hexToRgb(accentColor)}, 0.1)` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-extrabold text-sm text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 0 12px rgba(${hexToRgb(accentColor)}, 0.25)` }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] font-bold text-white leading-tight truncate">
                  {user?.organization?.name || 'GLOB FABRICATION AND ENTERPRISES'}
                </h4>
                <div className="text-[10px] font-bold mt-0.5" style={{ color: accentColor }}>
                  {user?.role === 'admin' ? '⚡ Admin' : user?.role || 'User'}
                </div>
                <div className="text-[9px] font-medium truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {user?.email || 'admin@globfabrication.com'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] btn-shine"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
              <RefreshCw size={12} /> Refresh
            </button>
            <button onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#f87171' }}>
              <LogOut size={12} /> Logout
            </button>
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
