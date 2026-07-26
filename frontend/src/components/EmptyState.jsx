import { Link } from 'react-router-dom'

// ═══════════════════════════════════════════
// EMPTY STATE COMPONENT
// Shows when tables/lists have no data — replaces empty rows
// ═══════════════════════════════════════════

export default function EmptyState({ 
  icon, 
  title = 'No data found', 
  description = '', 
  actionLabel = '', 
  actionPath = '', 
  className = '' 
}) {
  const IconComponent = icon
  
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}
      style={{ animation: 'entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
      {IconComponent && (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--accent)' }}>
          <IconComponent size={28} />
        </div>
      )}
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-white/30 text-center max-w-xs">{description}</p>
      )}
      {actionLabel && actionPath && (
        <Link to={actionPath}
          className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold text-white btn-primary btn-shine transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ animation: 'slideUp 0.3s ease-out 0.2s both' }}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
