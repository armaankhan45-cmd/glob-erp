// ═══════════════════════════════════════════
// SKELETON LOADING COMPONENTS
// Replaces raw spinner/loading states with shimmer placeholders
// ═══════════════════════════════════════════

export function SkeletonBlock({ w, h, radius = '12px', className = '', style = {} }) {
  return (
    <div className={className} style={{
      width: w, height: h, borderRadius: radius, ...style,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite'
    }} />
  )
}

export function SkeletonCard({ rows = 3, className = '' }) {
  return (
    <div className={`card ${className}`} style={{ animation: 'entranceScale 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
      <div className="flex items-center justify-between mb-4">
        <SkeletonBlock w="140px" h="18px" radius="6px" />
        <SkeletonBlock w="60px" h="32px" radius="8px" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <SkeletonBlock w="36px" h="36px" radius="8px" />
              <div>
                <SkeletonBlock w="100px" h="14px" radius="4px" />
                <SkeletonBlock w="140px" h="10px" radius="3px" className="mt-1" />
              </div>
            </div>
            <div className="text-right">
              <SkeletonBlock w="80px" h="14px" radius="4px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonMetric({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card" style={{ animation: `entranceScale 0.6s cubic-bezier(0.16,1,0.3,1) ${0.15 + i * 0.1}s both` }}>
          <div className="shimmer"></div>
          <div className="flex items-center justify-between mb-3">
            <SkeletonBlock w="80px" h="14px" radius="6px" />
            <SkeletonBlock w="40px" h="40px" radius="10px" />
          </div>
          <SkeletonBlock w="120px" h="28px" radius="6px" />
          <SkeletonBlock w="100px" h="12px" radius="4px" className="mt-2" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ className = '' }) {
  return (
    <div className={`card ${className}`} style={{ animation: 'entranceScale 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <SkeletonBlock w="160px" h="18px" radius="6px" />
          <SkeletonBlock w="120px" h="12px" radius="4px" className="mt-2" />
        </div>
        <SkeletonBlock w="120px" h="32px" radius="8px" />
      </div>
      <div style={{ height: 256, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 10px' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${30 + Math.random() * 70}%`,
            borderRadius: '6px 6px 0 0',
            background: 'linear-gradient(180deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-rgb),0.03))',
            animation: `entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`
          }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonTable({ cols = 5, rows = 6, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <SkeletonBlock w="180px" h="20px" radius="6px" />
        <SkeletonBlock w="100px" h="36px" radius="8px" />
      </div>
      {/* Header */}
      <div className="flex gap-4 mb-3 px-2">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} w={`${100/cols}%`} h="14px" radius="4px" />
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-2 py-2" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            {Array.from({ length: cols }).map((_, j) => (
              <SkeletonBlock key={j} w={`${100/cols}%`} h="12px" radius="3px" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
