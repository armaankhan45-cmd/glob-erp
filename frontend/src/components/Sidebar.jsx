import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, FileText, FileSpreadsheet, Users, ShoppingCart, Calculator, BarChart3, Settings, Download, RefreshCw, LogOut, Factory, Activity, Bot } from 'lucide-react'

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
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-brand-dark text-white flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo Area */}
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: '#ef4d23' }}>
            {user?.organization?.logo_url
              ? <img src={user.organization.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
              : <Factory size={20} className="text-white" />
            }
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight">{user?.organization?.name ? user.organization.name.split(' ').slice(0,2).join(' ') : 'Glob ERP'}</h1>
            <p className="text-[10px] text-white/40">Fabrication Manager</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-3">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 mb-1 font-semibold">{section}</p>
              {items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active bg-brand-orange text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <button
            onClick={() => window.location.reload()}
            className="sidebar-link w-full text-white/30 hover:text-white/60 hover:bg-white/5"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
