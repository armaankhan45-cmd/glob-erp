import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, FileText, FileSpreadsheet, Users, ShoppingCart, Calculator, BarChart3, Settings, Download, RefreshCw, LogOut, Factory, Activity, Bot, Upload } from 'lucide-react'

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
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sections = {}
  navItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push(item)
  })

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[280px] flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'rgba(6,8,15,0.97)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Logo Area */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #ef4d23, #ff6b35)' }}>
            {user?.organization?.logo_url
              ? <img src={user.organization.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
              : <Factory size={20} className="text-white" />
            }
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white">
              {user?.organization?.name ? user.organization.name.split(' ').slice(0, 2).join(' ') : 'Glob ERP'}
            </h1>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Fabrication Manager</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-3">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <p className="text-[9px] uppercase tracking-widest px-3 mb-1 font-bold"
                style={{ color: 'rgba(255,255,255,0.18)' }}>{section}</p>
              {items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom — Org info + User + Actions INSIDE sidebar */}
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Organization & User Card */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-extrabold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #ef4d23, #ff6b35)' }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] font-bold text-white leading-tight truncate">
                  {user?.organization?.name || 'GLOB FABRICATION AND ENTERPRISES'}
                </h4>
                <div className="text-[10px] font-semibold mt-0.5" style={{ color: '#ef4d23' }}>
                  {user?.role === 'admin' ? 'Admin' : user?.role || 'User'}
                </div>
                <div className="text-[9px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {user?.email || 'admin@globfabrication.com'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-medium transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => { e.target.style.color = 'rgba(255,255,255,0.7)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.target.style.color = 'rgba(255,255,255,0.35)'; e.target.style.background = 'rgba(255,255,255,0.03)' }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-medium transition-all duration-200"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.5)' }}
              onMouseEnter={e => { e.target.style.color = '#ef4444'; e.target.style.background = 'rgba(239,68,68,0.12)' }}
              onMouseLeave={e => { e.target.style.color = 'rgba(239,68,68,0.5)'; e.target.style.background = 'rgba(239,68,68,0.06)' }}
            >
              <LogOut size={12} /> Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
