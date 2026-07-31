import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * MagnetLines — Grid of lines that follow cursor (from ReactBits)
 * Perfect for login page background — subtle, premium feel
 */
export default function MagnetLines({
  rows = 8,
  columns = 10,
  containerSize = '100%',
  lineColor = 'rgba(var(--accent-rgb), 0.15)',
  lineWidth = '1px',
  lineHeight = '24px',
  baseAngle = -10,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null)
  const linesRef = useRef([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const rafRef = useRef(null)
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateDims = () => {
      setContainerDims({ w: el.clientWidth, h: el.clientHeight })
    }
    updateDims()
    const observer = new ResizeObserver(updateDims)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (containerDims.w === 0 || containerDims.h === 0) return

    const lines = linesRef.current
    if (!lines.length) return

    const cellW = containerDims.w / columns
    const cellH = containerDims.h / rows

    const animate = () => {
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line) continue

        const rect = line.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = mx - cx
        const dy = my - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        const maxDist = 200

        let angle = baseAngle
        if (dist < maxDist && mx > -500) {
          const influence = 1 - dist / maxDist
          const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
          angle = baseAngle + (targetAngle - baseAngle) * influence * 0.6
        }

        line.style.transform = `rotate(${angle}deg)`
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [containerDims, rows, columns, baseAngle])

  const handleMouseMove = useCallback((e) => {
    mouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 }
  }, [])

  const totalLines = rows * columns

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: containerSize,
        height: containerSize,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        placeItems: 'center',
        pointerEvents: 'auto',
        overflow: 'hidden',
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {Array.from({ length: totalLines }).map((_, i) => (
        <span
          key={i}
          ref={(el) => { linesRef.current[i] = el }}
          style={{
            display: 'block',
            width: lineWidth,
            height: lineHeight,
            background: lineColor,
            borderRadius: '2px',
            transform: `rotate(${baseAngle}deg)`,
            transition: 'transform 0.15s ease-out',
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  )
}
