import { useAuth } from '../context/AuthContext'
import { Bell, ChevronDown } from 'lucide-react'

export default function TopBar() {
  const { user } = useAuth()

  return (
    <header className="h-14 flex items-center justify-between px-5"
      style={{ background: 'rgba(12,16,32,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold tracking-tight text-white">
          {user?.organization?.name || 'Glob ERP'}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-xl flex items-center justify-center relative transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Bell size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full accent-bg" style={{ animation: 'pulseGlow 2s ease-in-out infinite' }}></div>
        </button>
        <div className="flex items-center gap-2.5 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white btn-primary"
            style={{ padding: 0, minWidth: 32, height: 32 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{user?.name || 'User'}</p>
            <p className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>{user?.email || ''}</p>
          </div>
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.25)' }} />
        </div>
      </div>
    </header>
  )
}
