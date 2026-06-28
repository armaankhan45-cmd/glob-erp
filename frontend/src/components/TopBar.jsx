import { useAuth } from '../context/AuthContext'
import { ChevronDown, Bell } from 'lucide-react'

export default function TopBar() {
  const { user } = useAuth()
  return (
    <header className="h-14 bg-white border-b border-neutral-200/60 flex items-center justify-between px-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-800 tracking-tight">
          {user?.organization?.name || 'Glob ERP'}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors relative">
          <Bell size={16} className="text-neutral-500" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-orange rounded-full"></div>
        </button>
        <div className="flex items-center gap-2.5 pl-3 border-l border-neutral-200">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: '#ef4d23' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-neutral-800 leading-tight">{user?.name || 'User'}</p>
            <p className="text-[10px] text-neutral-400 leading-tight">{user?.email || ''}</p>
          </div>
          <ChevronDown size={14} className="text-neutral-400" />
        </div>
      </div>
    </header>
  )
}
