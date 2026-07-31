import { useRef, useState, useCallback, useEffect } from 'react'

/**
 * BorderGlow — Card with glowing border that follows cursor (from ReactBits)
 * Premium hover effect for stat cards, info cards, etc.
 * Works with theme colors — accent color is used for glow
 */
export default function BorderGlow({
  children,
  className = '',
  style = {},
  borderRadius = 20,
  glowRadius = 30,
  glowIntensity = 0.8,
  edgeSensitivity = 30,
  animated = true,
  containerClassName = '',
}) {
  const containerRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 })
  const [isNearEdge, setIsNearEdge] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setMounted(true), 100)
      return () => clearTimeout(timer)
    }
  }, [animated])

  const handleMouseMove = useCallback((e) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMousePos({ x, y })

    // Check if near edge
    const nearLeft = x < edgeSensitivity
    const nearRight = x > rect.width - edgeSensitivity
    const nearTop = y < edgeSensitivity
    const nearBottom = y > rect.height - edgeSensitivity
    setIsNearEdge(nearLeft || nearRight || nearTop || nearBottom)
  }, [edgeSensitivity])

  const handleMouseLeave = useCallback(() => {
    setMousePos({ x: -1000, y: -1000 })
    setIsNearEdge(false)
    setIsHovered(false)
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  // Calculate glow position
  const glowX = mousePos.x
  const glowY = mousePos.y

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={{
        position: 'relative',
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      {/* Glow border overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: `${borderRadius}px`,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: isHovered ? (isNearEdge ? glowIntensity : glowIntensity * 0.4) : 0,
          transition: 'opacity 0.3s ease',
          background: `radial-gradient(${glowRadius * 2}px ${glowRadius * 2}px at ${glowX}px ${glowY}px, 
            rgba(var(--accent-rgb), 0.4), 
            rgba(var(--accent-rgb), 0.1) 40%, 
            transparent 70%)`,
          // Border glow effect
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1.5px',
        }}
      />

      {/* Animated intro sweep */}
      {animated && !mounted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: `${borderRadius}px`,
            pointerEvents: 'none',
            zIndex: 2,
            background: 'linear-gradient(90deg, transparent, rgba(var(--accent-rgb), 0.3), transparent)',
            animation: 'borderSweep 1s ease-out forwards',
          }}
        />
      )}

      {/* Content */}
      <div
        className={className}
        style={{
          position: 'relative',
          zIndex: 0,
          borderRadius: `${borderRadius - 1}px`,
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes borderSweep {
          0% { transform: translateX(-100%); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
